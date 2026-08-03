/**
 * Источник случайности как зависимость.
 *
 * Домен и противник ничего не знают про `Math.random`: им передают `Rng`.
 * Благодаря этому партия воспроизводится по зерну — то же зерно даёт ту же
 * расстановку и ту же последовательность выстрелов, что и делает игру тестируемой.
 */
export interface Rng {
  /** Следующее число в диапазоне [0, 1). */
  next(): number;
  /** Целое в диапазоне [0, bound). Для bound ≤ 0 всегда 0. */
  int(bound: number): number;
  /** Случайный элемент непустого списка. */
  pick<T>(items: readonly T[]): T;
}

/**
 * mulberry32 — короткий генератор с периодом 2³² и приличным распределением.
 * Криптостойкость здесь не нужна, нужна повторяемость и скорость: за партию
 * противник дёргает его тысячи раз.
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
      if (!items.length) throw new RangeError('Rng.pick: пустой список');
      return items[int(items.length)];
    },
  };
}

/**
 * Зерно для настоящей партии. Живёт вне домена по смыслу: это единственное
 * место, где игра берёт непредсказуемость извне.
 */
export function entropySeed(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0];
}
