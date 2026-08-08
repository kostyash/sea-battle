import { Service, signal } from '@angular/core';

/**
 * All sound is synthesised on the spot — not a single file is loaded.
 * The context wakes up on the first click, as the browser demands.
 */
/**
 * The settings store may be unavailable: inside a `sandbox="allow-scripts"` frame,
 * or when site data is blocked, touching it throws a SecurityError. Sound is not
 * a good enough reason for the game to refuse to open, so we swallow the failure.
 */
/** Volume of the shared bus. */
const BUS_VOLUME = 0.55;

function readMuted(): boolean {
  try {
    return localStorage.getItem('sb.muted') === '1';
  } catch {
    return false;
  }
}

function rememberMuted(value: boolean): void {
  try {
    localStorage.setItem('sb.muted', value ? '1' : '0');
  } catch {
    // the setting won't survive a reload — no reason to break the game over it
  }
}

@Service()
export class AudioService {
  readonly muted = signal(readMuted());

  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  toggle(): void {
    const next = !this.muted();
    this.muted.set(next);
    rememberMuted(next);

    if (next) this.silenceNow();
    else this.restoreVolume();
  }

  /**
   * The cut-off in `wake()` only works at scheduling time: nodes already queued
   * will play out. The sinking groan runs for 1.3 s — nobody is going to wait
   * that long for silence after pressing "sound off", so we mute the bus itself.
   */
  private silenceNow(): void {
    if (!this.ctx || !this.bus) return;
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(0.0001, t);
  }

  private restoreVolume(): void {
    if (this.ctx && this.bus) {
      this.bus.gain.cancelScheduledValues(this.ctx.currentTime);
      this.bus.gain.setValueAtTime(BUS_VOLUME, this.ctx.currentTime);
    }
    this.blip(660, 0.08, 'triangle', 0.12);
  }

  /** The click of a ship being placed on the chart. */
  place(): void {
    this.blip(180, 0.07, 'triangle', 0.16);
    this.blip(90, 0.11, 'sine', 0.12, 0.01);
  }

  rotate(): void {
    this.blip(420, 0.05, 'square', 0.05);
  }

  /** Sonar: the shot is away, waiting for the result. */
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

  /** A splash — a miss. */
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

  /** A hit — a dull thump and the crack of splitting plating. */
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

  /** The ship goes under. */
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

  /* ── internals ──────────────────────────────────────────────────────── */

  private wake(): AudioContext | null {
    if (this.muted()) return null;
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.bus = this.ctx.createGain();
      this.bus.gain.value = BUS_VOLUME;
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
