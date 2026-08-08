import { CellState } from '../domain/board';
import { CELLS, SIZE, colOf, idx, inBounds, rowOf } from '../domain/grid';
import { Rng } from '../domain/rng';

/**
 * Admiral: the density map.
 *
 * For every ship size still afloat we enumerate all of its placements that are
 * consistent with the marks on the board, and each cell accumulates weight from
 * the number of placements passing through it. Shoot where a ship has nowhere to
 * hide.
 *
 * Finishing off a wounded ship needs no separate mode: a placement covering an
 * open hit gets a weight an order of magnitude higher, so the maximum drifts to
 * the wounded ship on its own.
 */

/** How many times more valuable a placement becomes per open hit it covers. */
const WOUND_WEIGHT = 24;

export function densityMap(
  shots: readonly CellState[],
  afloat: readonly number[],
): { score: number[]; mustFinish: boolean } {
  const wounded = shots.some((s) => s === 'hit');
  const score = new Array<number>(CELLS).fill(0);

  const bySize = new Map<number, number>();
  for (const size of afloat) bySize.set(size, (bySize.get(size) ?? 0) + 1);

  for (const [size, count] of bySize) {
    // a single-deck ship placed "vertically" is the same ship — don't count it twice
    const orients: readonly (readonly [number, number])[] =
      size === 1 ? [[0, 1]] : [
        [0, 1],
        [1, 0],
      ];

    for (const [dr, dc] of orients) {
      const rows = dr ? SIZE - size + 1 : SIZE;
      const cols = dc ? SIZE - size + 1 : SIZE;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const span: number[] = [];
          for (let k = 0; k < size; k++) span.push(idx(r + dr * k, c + dc * k));

          if (span.some((i) => shots[i] === 'miss' || shots[i] === 'sunk')) continue;
          // ships never touch: it cannot sit flush against another ship's open hit
          if (touchesForeignHit(shots, span)) continue;

          const covered = span.filter((i) => shots[i] === 'hit').length;
          if (wounded && covered === 0) continue;

          const weight = count * Math.pow(WOUND_WEIGHT, covered);
          for (const i of span) if (shots[i] === 'unknown') score[i] += weight;
        }
      }
    }
  }

  return { score, mustFinish: wounded };
}

/**
 * The cell with the highest density, or -1 if no placement fit at all
 * (then it is up to the caller — fall back to the Midshipman search).
 */
export function densityShot(
  shots: readonly CellState[],
  afloat: readonly number[],
  open: readonly number[],
  rng: Rng,
): number {
  const { score } = densityMap(shots, afloat);

  let top = 0;
  const ties: number[] = [];
  for (const i of open) {
    if (score[i] > top) {
      top = score[i];
      ties.length = 0;
      ties.push(i);
    } else if (score[i] === top && top > 0) {
      ties.push(i);
    }
  }

  return ties.length ? rng.pick(ties) : -1;
}

/** Whether an open hit the candidate hull does not cover sits next to it. */
export function touchesForeignHit(shots: readonly CellState[], span: readonly number[]): boolean {
  const own = new Set(span);
  for (const c of span) {
    const r = rowOf(c);
    const k = colOf(c);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dk = -1; dk <= 1; dk++) {
        const nr = r + dr;
        const nk = k + dk;
        if (!inBounds(nr, nk)) continue;
        const n = idx(nr, nk);
        if (!own.has(n) && shots[n] === 'hit') return true;
      }
    }
  }
  return false;
}
