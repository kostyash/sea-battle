import { CellState } from '../domain/board';
import { CELLS, colOf, idx, inBounds, rowOf } from '../domain/grid';
import { Rng } from '../domain/rng';
import { densityShot } from './density';
import { Difficulty } from './levels';

/**
 * The opponent sees exactly what the player sees: the grid of marks and the list
 * of ship sizes not yet sunk. It never peeks at the enemy deployment — that is
 * simply not passed in here. Randomness comes from outside, so a game replays.
 *
 * Returns a cell index, or -1 if there is nothing left to shoot at.
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
    case 'cabin-boy':
      return novice(shots, open, rng);
    case 'midshipman':
      return officer(shots, afloat, open, rng);
    default: {
      // if no placement fit at all — fall back to the Midshipman search
      const dense = densityShot(shots, afloat, open, rng);
      return dense === -1 ? officer(shots, afloat, open, rng) : dense;
    }
  }
}

/* ── Cabin Boy: fires blind, finishes off every other time ─────────────── */

function novice(shots: readonly CellState[], open: number[], rng: Rng): number {
  const wounded = cellsWhere((i) => shots[i] === 'hit');
  if (wounded.length && rng.next() < 0.55) {
    const near = neighbourhood(wounded).filter((i) => shots[i] === 'unknown');
    if (near.length) return rng.pick(near);
  }
  return rng.pick(open);
}

/* ── Midshipman: every-other-cell search, finish off along the line ─────── */

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

  // Searching every other cell pays off while at least one multi-deck ship is
  // afloat: a checkerboard cannot miss such a target. The single-deck boats get
  // mopped up cell by cell at the end.
  const biggest = afloat.length ? Math.max(...afloat) : 1;
  const step = biggest > 1 ? 2 : 1;
  const grid = open.filter((i) => (rowOf(i) + colOf(i)) % step === 0);
  return rng.pick(grid.length ? grid : open);
}

/** The continuation of an already traced line of hits — both of its ends. */
function alignedTargets(shots: readonly CellState[], wounded: number[]): number[] {
  const set = new Set(wounded);
  const out: number[] = [];

  for (const c of wounded) {
    for (const [dr, dc] of DIRECTIONS) {
      const back = step(c, -dr, -dc);
      if (back === -1 || !set.has(back)) continue; // a neighbour behind proves a line
      let n = step(c, dr, dc);
      while (n !== -1 && set.has(n)) n = step(n, dr, dc);
      if (n !== -1 && shots[n] === 'unknown') out.push(n);
    }
  }
  return out;
}

/* ── shared ────────────────────────────────────────────────────────────── */

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
