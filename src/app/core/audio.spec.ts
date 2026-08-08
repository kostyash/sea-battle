import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioService } from './audio';

/**
 * Sound is synthesised with WebAudio, which jsdom does not have. A fake context
 * lets us check not "how it sounds" but the thing this code was written for:
 * that the game does not fall over without sound, and that "off" really does mute.
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
    FakeCtx.created = 0;
    vi.stubGlobal('AudioContext', FakeCtx);
  });

  afterEach(() => {
    // The Storage.prototype stub is global: leave it in place and the next test will
    // read somebody else's deception instead of the storage. We undo it unconditionally,
    // not at the end of a test that may never reach its end.
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  describe('unavailable storage does not bring the game down', () => {
    it('a ban on reading does not stop the service from being created', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Denied', 'SecurityError');
      });

      let audio: AudioService | null = null;
      expect(() => (audio = service())).not.toThrow();
      expect(audio!.muted()).toBe(false);
    });

    it('a ban on writing does not stop the sound from being toggled', () => {
      const audio = service();
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Denied', 'SecurityError');
      });

      expect(() => audio.toggle()).not.toThrow();
      expect(audio.muted()).toBe(true);
    });
  });

  describe('the setting is remembered', () => {
    it('by default the sound is on', () => {
      expect(service().muted()).toBe(false);
    });

    it('the previous choice is restored', () => {
      localStorage.setItem('sb.muted', '1');
      expect(service().muted()).toBe(true);
    });

    it('a toggle is written to the storage', () => {
      const audio = service();
      audio.toggle();
      expect(localStorage.getItem('sb.muted')).toBe('1');
      audio.toggle();
      expect(localStorage.getItem('sb.muted')).toBe('0');
    });
  });

  describe('muting cuts off whatever is already sounding', () => {
    it('the bus is silenced at once, not after the fade-out', () => {
      const audio = service();
      audio.sunk(); // woke the context up, scheduled a long groan
      const ctx = TestBed.inject(AudioService) as unknown as { ctx: FakeCtx };
      const bus = ctx.ctx.bus!;
      bus.gain.calls.length = 0;

      audio.toggle(); // off

      expect(bus.gain.calls).toContain('cancel');
      expect(bus.gain.value).toBeCloseTo(0.0001);
    });

    it('unmuting brings the volume back', () => {
      const audio = service();
      audio.sunk();
      const ctx = TestBed.inject(AudioService) as unknown as { ctx: FakeCtx };
      const bus = ctx.ctx.bus!;

      audio.toggle();
      audio.toggle();

      expect(bus.gain.value).toBeCloseTo(0.55);
    });

    it('muting before the first sound breaks nothing', () => {
      const audio = service();
      expect(() => audio.toggle()).not.toThrow();
      expect(FakeCtx.created).toBe(0);
    });
  });

  describe('without WebAudio the game carries on', () => {
    it('a missing AudioContext throws no exceptions', () => {
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

    it('in silence the context is not created at all', () => {
      localStorage.setItem('sb.muted', '1');
      const audio = service();
      audio.hit();
      audio.sunk();
      expect(FakeCtx.created).toBe(0);
    });
  });

  describe('the sounds of a game', () => {
    it('the context is created once for all the sounds', () => {
      const audio = service();
      audio.place();
      audio.hit();
      audio.sunk();
      expect(FakeCtx.created).toBe(1);
    });

    it('every sound starts and then stops its own nodes', () => {
      const audio = service();
      audio.hit();
      const ctx = TestBed.inject(AudioService) as unknown as { ctx: FakeCtx };
      const sounding = ctx.ctx.nodes.filter((n) => n.started > 0);
      expect(sounding.length).toBeGreaterThan(0);
      expect(sounding.every((n) => n.stopped > 0)).toBe(true);
    });

    it('a suspended context gets woken up', () => {
      const audio = service();
      audio.place();
      const ctx = TestBed.inject(AudioService) as unknown as { ctx: FakeCtx };
      ctx.ctx.state = 'suspended';
      audio.hit();
      expect(ctx.ctx.state).toBe('running');
    });
  });
});
