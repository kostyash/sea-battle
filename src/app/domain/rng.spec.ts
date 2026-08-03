import { describe, expect, it } from 'vitest';
import { entropySeed, seededRng } from './rng';

const take = (seed: number, n: number): number[] => {
  const rng = seededRng(seed);
  return Array.from({ length: n }, () => rng.next());
};

describe('seededRng', () => {
  it('одно зерно — одна и та же последовательность', () => {
    expect(take(12345, 20)).toEqual(take(12345, 20));
  });

  it('разные зёрна расходятся', () => {
    expect(take(1, 20)).not.toEqual(take(2, 20));
  });

  it('next() не выходит из [0, 1)', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 5000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('распределение не вырождено: обе половины отрезка заселены', () => {
    const rng = seededRng(99);
    let low = 0;
    for (let i = 0; i < 4000; i++) if (rng.next() < 0.5) low++;
    expect(low).toBeGreaterThan(1700);
    expect(low).toBeLessThan(2300);
  });

  it('отрицательное зерно приводится к беззнаковому и работает', () => {
    expect(take(-5, 10)).toEqual(take(-5 >>> 0, 10));
  });

  describe('int()', () => {
    it('держится в [0, bound) и покрывает все значения', () => {
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

    it('bound = 1 всегда даёт 0', () => {
      const rng = seededRng(3);
      expect([rng.int(1), rng.int(1), rng.int(1)]).toEqual([0, 0, 0]);
    });

    it('bound = 0 и отрицательный дают 0 и не трогают состояние', () => {
      const rng = seededRng(42);
      expect(rng.int(0)).toBe(0);
      expect(rng.int(-3)).toBe(0);
      // состояние не сдвинулось: следующий next() совпадает с первым у чистого генератора
      expect(rng.next()).toBe(seededRng(42).next());
    });
  });

  describe('pick()', () => {
    it('возвращает элемент списка', () => {
      const rng = seededRng(11);
      const items = ['а', 'б', 'в', 'г'] as const;
      for (let i = 0; i < 200; i++) expect(items).toContain(rng.pick(items));
    });

    it('со временем достаёт каждый элемент', () => {
      const rng = seededRng(555);
      const items = [1, 2, 3];
      const seen = new Set(Array.from({ length: 300 }, () => rng.pick(items)));
      expect([...seen].sort()).toEqual([1, 2, 3]);
    });

    it('из списка на один элемент возвращает его же', () => {
      expect(seededRng(1).pick(['единственный'])).toBe('единственный');
    });

    it('на пустом списке падает внятно', () => {
      expect(() => seededRng(1).pick([])).toThrow(RangeError);
      expect(() => seededRng(1).pick([])).toThrow(/пустой список/);
    });
  });
});

describe('entropySeed', () => {
  it('даёт беззнаковое 32-битное целое', () => {
    const seed = entropySeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
  });

  it('два вызова почти наверняка различаются', () => {
    const seeds = new Set(Array.from({ length: 50 }, () => entropySeed()));
    expect(seeds.size).toBeGreaterThan(45);
  });
});
