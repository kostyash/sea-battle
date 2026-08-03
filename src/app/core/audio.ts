import { Injectable, signal } from '@angular/core';

/**
 * Весь звук синтезируется на месте — ни одного загружаемого файла.
 * Контекст просыпается на первом клике, как того требует браузер.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  readonly muted = signal(localStorage.getItem('sb.muted') === '1');

  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  toggle(): void {
    const next = !this.muted();
    this.muted.set(next);
    localStorage.setItem('sb.muted', next ? '1' : '0');
    if (!next) this.blip(660, 0.08, 'triangle', 0.12);
  }

  /** Щелчок при постановке корабля на карту. */
  place(): void {
    this.blip(180, 0.07, 'triangle', 0.16);
    this.blip(90, 0.11, 'sine', 0.12, 0.01);
  }

  rotate(): void {
    this.blip(420, 0.05, 'square', 0.05);
  }

  /** Гидролокатор: выстрел ушёл, ждём результата. */
  ping(): void {
    const ctx = this.wake();
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const [delay, gain] of [
      [0, 0.16],
      [0.26, 0.07],
      [0.52, 0.03],
    ] as const) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1250, t + delay);
      osc.frequency.exponentialRampToValueAtTime(720, t + delay + 0.34);
      g.gain.setValueAtTime(0.0001, t + delay);
      g.gain.exponentialRampToValueAtTime(gain, t + delay + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.42);
      osc.connect(g).connect(this.bus!);
      osc.start(t + delay);
      osc.stop(t + delay + 0.45);
    }
  }

  /** Всплеск — мимо. */
  splash(): void {
    const ctx = this.wake();
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, t);
    filter.frequency.exponentialRampToValueAtTime(280, t + 0.42);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    src.connect(filter).connect(g).connect(this.bus!);
    src.start(t);
    src.stop(t + 0.55);
  }

  /** Попадание — глухой удар и треск обшивки. */
  hit(): void {
    const ctx = this.wake();
    if (!ctx) return;
    const t = ctx.currentTime;

    const thump = ctx.createOscillator();
    const tg = ctx.createGain();
    thump.type = 'sawtooth';
    thump.frequency.setValueAtTime(160, t);
    thump.frequency.exponentialRampToValueAtTime(42, t + 0.35);
    tg.gain.setValueAtTime(0.34, t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    thump.connect(tg).connect(this.bus!);
    thump.start(t);
    thump.stop(t + 0.6);

    const crack = ctx.createBufferSource();
    crack.buffer = this.noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1800, t);
    bp.Q.value = 0.7;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.3, t);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    crack.connect(bp).connect(cg).connect(this.bus!);
    crack.start(t);
    crack.stop(t + 0.3);
  }

  /** Корабль уходит под воду. */
  sunk(): void {
    const ctx = this.wake();
    if (!ctx) return;
    const t = ctx.currentTime;

    const groan = ctx.createOscillator();
    const g = ctx.createGain();
    groan.type = 'sawtooth';
    groan.frequency.setValueAtTime(230, t);
    groan.frequency.exponentialRampToValueAtTime(38, t + 1.15);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + 1.15);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
    groan.connect(lp).connect(g).connect(this.bus!);
    groan.start(t);
    groan.stop(t + 1.3);

    const rumble = ctx.createBufferSource();
    rumble.buffer = this.noiseBuffer(ctx);
    const rl = ctx.createBiquadFilter();
    rl.type = 'lowpass';
    rl.frequency.value = 320;
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.22, t);
    rg.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    rumble.connect(rl).connect(rg).connect(this.bus!);
    rumble.start(t);
    rumble.stop(t + 1.15);
  }

  victory(): void {
    [0, 0.16, 0.32, 0.62].forEach((d, i) => {
      this.blip([392, 523, 659, 784][i], 0.5, 'square', 0.13, d, 900);
    });
  }

  defeat(): void {
    [0, 0.34].forEach((d, i) => {
      this.blip([196, 147][i], 0.9, 'sawtooth', 0.16, d, 420);
    });
  }

  /* ── внутреннее ─────────────────────────────────────────────────────── */

  private wake(): AudioContext | null {
    if (this.muted()) return null;
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.bus = this.ctx.createGain();
      this.bus.gain.value = 0.55;
      this.bus.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noise) {
      const len = ctx.sampleRate * 1.5;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }

  private blip(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
    cutoff?: number,
  ): void {
    const ctx = this.wake();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = osc.connect(g);
    if (cutoff) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = cutoff;
      node = node.connect(lp);
    }
    node.connect(this.bus!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}
