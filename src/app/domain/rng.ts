/**
 * The source of randomness as a dependency.
 *
 * The domain and the opponent know nothing about `Math.random`: they are handed
 * an `Rng`. That is what makes a game reproducible from a seed — the same seed
 * yields the same deployment and the same sequence of shots, which is what makes
 * the game testable.
 */
export interface Rng {
  /** The next number in the range [0, 1). */
  next(): number;
  /** An integer in the range [0, bound). For bound ≤ 0 always 0. */
  int(bound: number): number;
  /** A random element of a non-empty list. */
  pick<T>(items: readonly T[]): T;
}

/**
 * mulberry32 — a tiny generator with a period of 2³² and a decent distribution.
 * Cryptographic strength is not needed here; repeatability and speed are: over a
 * single game the opponent pulls on it thousands of times.
 */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (bound: number): number => (bound <= 0 ? 0 : Math.floor(next() * bound));

  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (!items.length) throw new RangeError('Rng.pick: empty list');
      return items[int(items.length)];
    },
  };
}

/**
 * The seed for a real game. It belongs outside the domain by its very nature:
 * this is the one place where the game draws unpredictability from outside.
 */
export function entropySeed(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0];
}
