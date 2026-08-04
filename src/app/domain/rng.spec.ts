import { describe, expect, it } from 'vitest';
import { entropySeed, seededRng } from './rng';

const take = (seed: number, n: number): number[] => {
  const rng = seededRng(seed);
  return Array.from({ length: n }, () => rng.next());
};

describe('seededRng', () => {
  it('one seed — one and the same sequence', () => {
    expect(take(12345, 20)).toEqual(take(12345, 20));
  });

  it('different seeds diverge', () => {
    expect(take(1, 20)).not.toEqual(take(2, 20));
  });

  it('next() never leaves [0, 1)', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 5000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('the distribution is not degenerate: both halves of the interval are populated', () => {
    const rng = seededRng(99);
    let low = 0;
    for (let i = 0; i < 4000; i++) if (rng.next() < 0.5) low++;
    expect(low).toBeGreaterThan(1700);
    expect(low).toBeLessThan(2300);
  });

  it('a negative seed is coerced to unsigned and still works', () => {
    expect(take(-5, 10)).toEqual(take(-5 >>> 0, 10));
  });

  describe('int()', () => {
    it('keeps to [0, bound) and covers every value', () => {
      const rng = seededRng(2024);
      const seen = new Set<number>();
      for (let i = 0; i < 3000; i++) {
        const v = rng.int(10);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(10);
        seen.add(v);
      }
      expect(seen.size).toBe(10);
    });

    it('bound = 1 always gives 0', () => {
      const rng = seededRng(3);
      expect([rng.int(1), rng.int(1), rng.int(1)]).toEqual([0, 0, 0]);
    });

    it('bound = 0 and a negative bound give 0 and leave the state alone', () => {
      const rng = seededRng(42);
      expect(rng.int(0)).toBe(0);
      expect(rng.int(-3)).toBe(0);
      // the state has not moved: the next next() matches the first one of a fresh generator
      expect(rng.next()).toBe(seededRng(42).next());
    });
  });

  describe('pick()', () => {
    it('returns an element of the list', () => {
      const rng = seededRng(11);
      const items = ['a', 'b', 'c', 'd'] as const;
      for (let i = 0; i < 200; i++) expect(items).toContain(rng.pick(items));
    });

    it('given time, it draws every element', () => {
      const rng = seededRng(555);
      const items = [1, 2, 3];
      const seen = new Set(Array.from({ length: 300 }, () => rng.pick(items)));
      expect([...seen].sort()).toEqual([1, 2, 3]);
    });

    it('from a one-element list it returns that very element', () => {
      expect(seededRng(1).pick(['the only one'])).toBe('the only one');
    });

    it('on an empty list it fails loudly and clearly', () => {
      expect(() => seededRng(1).pick([])).toThrow(RangeError);
      expect(() => seededRng(1).pick([])).toThrow(/empty list/);
    });
  });
});

describe('entropySeed', () => {
  it('gives an unsigned 32-bit integer', () => {
    const seed = entropySeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
  });

  it('two calls almost certainly differ', () => {
    const seeds = new Set(Array.from({ length: 50 }, () => entropySeed()));
    expect(seeds.size).toBeGreaterThan(45);
  });
});
