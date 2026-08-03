import { CellState } from '../domain/board';
import { CELLS, colOf, idx, inBounds, rowOf } from '../domain/grid';
import { Rng } from '../domain/rng';
import { densityShot } from './density';
import { Difficulty } from './levels';

/**
 * Противник видит ровно то же, что игрок: сетку отметок и список ещё не
 * потопленных калибров. В чужую расстановку он не заглядывает — сюда её просто
 * не передают. Случайность приходит извне, поэтому партия воспроизводима.
 *
 * Возвращает индекс клетки или -1, если стрелять уже некуда.
 */
export function chooseShot(
  shots: readonly CellState[],
  afloat: readonly number[],
  level: Difficulty,
  rng: Rng,
): number {
  const open = cellsWhere((i) => shots[i] === 'unknown');
  if (!open.length) return -1;

  switch (level) {
    case 'yunga':
      return novice(shots, open, rng);
    case 'michman':
      return officer(shots, afloat, open, rng);
    default: {
      // если ни одна расстановка не сошлась — падаем в мичманский поиск
      const dense = densityShot(shots, afloat, open, rng);
      return dense === -1 ? officer(shots, afloat, open, rng) : dense;
    }
  }
}

/* ── Юнга: бьёт наугад и добивает через раз ────────────────────────────── */

function novice(shots: readonly CellState[], open: number[], rng: Rng): number {
  const wounded = cellsWhere((i) => shots[i] === 'hit');
  if (wounded.length && rng.next() < 0.55) {
    const near = neighbourhood(wounded).filter((i) => shots[i] === 'unknown');
    if (near.length) return rng.pick(near);
  }
  return rng.pick(open);
}

/* ── Мичман: поиск через клетку, добивание по линии ─────────────────────── */

export function officer(
  shots: readonly CellState[],
  afloat: readonly number[],
  open: number[],
  rng: Rng,
): number {
  const wounded = cellsWhere((i) => shots[i] === 'hit');

  if (wounded.length) {
    const inline = alignedTargets(shots, wounded);
    if (inline.length) return rng.pick(inline);
    const near = neighbourhood(wounded).filter((i) => shots[i] === 'unknown');
    if (near.length) return rng.pick(near);
  }

  // Через клетку имеет смысл искать, пока на плаву есть хоть один многопалубный:
  // такую цель шахматная сетка не пропустит. Катера добираются в конце сплошняком.
  const biggest = afloat.length ? Math.max(...afloat) : 1;
  const step = biggest > 1 ? 2 : 1;
  const grid = open.filter((i) => (rowOf(i) + colOf(i)) % step === 0);
  return rng.pick(grid.length ? grid : open);
}

/** Продолжение уже нащупанной линии попаданий — оба её конца. */
function alignedTargets(shots: readonly CellState[], wounded: number[]): number[] {
  const set = new Set(wounded);
  const out: number[] = [];

  for (const c of wounded) {
    for (const [dr, dc] of DIRECTIONS) {
      const back = step(c, -dr, -dc);
      if (back === -1 || !set.has(back)) continue; // нужен сосед сзади — значит есть линия
      let n = step(c, dr, dc);
      while (n !== -1 && set.has(n)) n = step(n, dr, dc);
      if (n !== -1 && shots[n] === 'unknown') out.push(n);
    }
  }
  return out;
}

/* ── общее ─────────────────────────────────────────────────────────────── */

const DIRECTIONS = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
] as const;

export function cellsWhere(match: (i: number) => boolean): number[] {
  const out: number[] = [];
  for (let i = 0; i < CELLS; i++) if (match(i)) out.push(i);
  return out;
}

export function step(cell: number, dr: number, dc: number): number {
  const r = rowOf(cell) + dr;
  const c = colOf(cell) + dc;
  return inBounds(r, c) ? idx(r, c) : -1;
}

function neighbourhood(cells: readonly number[]): number[] {
  const out = new Set<number>();
  for (const c of cells) {
    for (const [dr, dc] of DIRECTIONS) {
      const n = step(c, dr, dc);
      if (n !== -1) out.add(n);
    }
  }
  return [...out];
}
