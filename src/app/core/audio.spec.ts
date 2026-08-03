import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioService } from './audio';

/**
 * Звук синтезируется на WebAudio, которого в jsdom нет. Поддельный контекст
 * позволяет проверить не «как звучит», а то, ради чего этот код и написан:
 * что игра не падает без звука и что «выкл» действительно выключает.
 */
class FakeParam {
  value = 0;
  readonly calls: string[] = [];
  setValueAtTime(v: number): void {
    this.value = v;
    this.calls.push(`set:${v}`);
  }
  exponentialRampToValueAtTime(v: number): void {
    this.calls.push(`ramp:${v}`);
  }
  cancelScheduledValues(): void {
    this.calls.push('cancel');
  }
}

class FakeNode {
  readonly gain = new FakeParam();
  readonly frequency = new FakeParam();
  readonly Q = new FakeParam();
  type = '';
  buffer: unknown = null;
  started = 0;
  stopped = 0;
  connect<T>(target: T): T {
    return target;
  }
  start(): void {
    this.started++;
  }
  stop(): void {
    this.stopped++;
  }
}

class FakeCtx {
  static created = 0;
  state = 'running';
  currentTime = 0;
  sampleRate = 44100;
  readonly destination = new FakeNode();
  readonly nodes: FakeNode[] = [];
  bus: FakeNode | null = null;

  constructor() {
    FakeCtx.created++;
  }
  private make(): FakeNode {
    const n = new FakeNode();
    this.nodes.push(n);
    return n;
  }
  createGain(): FakeNode {
    const n = this.make();
    if (!this.bus) this.bus = n;
    return n;
  }
  createOscillator(): FakeNode {
    return this.make();
  }
  createBiquadFilter(): FakeNode {
    return this.make();
  }
  createBufferSource(): FakeNode {
    return this.make();
  }
  createBuffer(): { getChannelData: () => Float32Array } {
    const data = new Float32Array(16);
    return { getChannelData: () => data };
  }
  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
}

const service = (): AudioService => {
  TestBed.configureTestingModule({});
  return TestBed.inject(AudioService);
};

describe('AudioService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    FakeCtx.created = 0;
    vi.stubGlobal('AudioContext', FakeCtx);
  });

  afterEach(() => {
    // Подмена Storage.prototype глобальна: не сними её — и следующий тест будет
    // читать чужой обман вместо хранилища. Снимаем безусловно, а не в конце теста,
    // который может до этого конца и не дойти.
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  describe('недоступное хранилище не роняет игру', () => {
    it('запрет на чтение не мешает создать службу', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Отказано', 'SecurityError');
      });

      let audio: AudioService | null = null;
      expect(() => (audio = service())).not.toThrow();
      expect(audio!.muted()).toBe(false);
    });

    it('запрет на запись не мешает переключить звук', () => {
      const audio = service();
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Отказано', 'SecurityError');
      });

      expect(() => audio.toggle()).not.toThrow();
      expect(audio.muted()).toBe(true);
    });
  });

  describe('настройка запоминается', () => {
    it('по умолчанию звук включён', () => {
      expect(service().muted()).toBe(false);
    });

    it('прошлый выбор восстанавливается', () => {
      localStorage.setItem('sb.muted', '1');
      expect(service().muted()).toBe(true);
    });

    it('переключение пишется в хранилище', () => {
      const audio = service();
      audio.toggle();
      expect(localStorage.getItem('sb.muted')).toBe('1');
      audio.toggle();
      expect(localStorage.getItem('sb.muted')).toBe('0');
    });
  });

  describe('выключение обрывает уже звучащее', () => {
    it('шина глушится сразу, а не после затухания', () => {
      const audio = service();
      audio.sunk(); // разбудили контекст, запланировали длинный стон
      const ctx = TestBed.inject(AudioService) as unknown as { ctx: FakeCtx };
      const bus = ctx.ctx.bus!;
      bus.gain.calls.length = 0;

      audio.toggle(); // выкл

      expect(bus.gain.calls).toContain('cancel');
      expect(bus.gain.value).toBeCloseTo(0.0001);
    });

    it('включение возвращает громкость', () => {
      const audio = service();
      audio.sunk();
      const ctx = TestBed.inject(AudioService) as unknown as { ctx: FakeCtx };
      const bus = ctx.ctx.bus!;

      audio.toggle();
      audio.toggle();

      expect(bus.gain.value).toBeCloseTo(0.55);
    });

    it('выключение до первого звука ничего не ломает', () => {
      const audio = service();
      expect(() => audio.toggle()).not.toThrow();
      expect(FakeCtx.created).toBe(0);
    });
  });

  describe('без WebAudio игра продолжается', () => {
    it('отсутствие AudioContext не бросает исключений', () => {
      vi.stubGlobal('AudioContext', undefined);
      const audio = service();
      expect(() => {
        audio.place();
        audio.ping();
        audio.splash();
        audio.hit();
        audio.sunk();
        audio.victory();
        audio.defeat();
        audio.rotate();
      }).not.toThrow();
    });

    it('в тишине контекст не создаётся вовсе', () => {
      localStorage.setItem('sb.muted', '1');
      const audio = service();
      audio.hit();
      audio.sunk();
      expect(FakeCtx.created).toBe(0);
    });
  });

  describe('звуки партии', () => {
    it('контекст создаётся один раз на все звуки', () => {
      const audio = service();
      audio.place();
      audio.hit();
      audio.sunk();
      expect(FakeCtx.created).toBe(1);
    });

    it('каждый звук запускает и останавливает свои узлы', () => {
      const audio = service();
      audio.hit();
      const ctx = TestBed.inject(AudioService) as unknown as { ctx: FakeCtx };
      const sounding = ctx.ctx.nodes.filter((n) => n.started > 0);
      expect(sounding.length).toBeGreaterThan(0);
      expect(sounding.every((n) => n.stopped > 0)).toBe(true);
    });

    it('усыплённый контекст будится', () => {
      const audio = service();
      audio.place();
      const ctx = TestBed.inject(AudioService) as unknown as { ctx: FakeCtx };
      ctx.ctx.state = 'suspended';
      audio.hit();
      expect(ctx.ctx.state).toBe('running');
    });
  });
});
