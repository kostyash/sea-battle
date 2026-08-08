import { Board, CellState } from '../domain/board';
import { FLEET_SPEC } from '../domain/fleet';
import { CELLS, Side } from '../domain/grid';
import { randomBoard } from '../domain/placement';
import { Rng } from '../domain/rng';
import { densityMap } from './density';

/**
 * Where the opponent moors its own fleet.
 *
 * Drawing a legal deployment at random is not neutral. The no-touching rule
 * leaves far more room in the middle of the square than along the edges, so a
 * uniform draw crowds the ships into the centre — and the centre is precisely
 * where any density-counting hunter looks first. The fleet ends up moored where
 * it is easiest to find.
 *
 * So the deployment is drawn against that map: a handful of legal fleets are
 * dealt and the one lying in the coldest water — the squares a hunter reaches
 * last — is the one that puts to sea.
 *
 * It is deliberately best-of-a-few rather than the coldest fleet obtainable.
 * Squeezed harder, every game would open with ships hugging the same edges and
 * corners, and a habit is worth more to an opponent than a good average. This
 * keeps the spread of a random draw and merely leans it away from the middle.
 */

/** The whole fleet as a list of lengths — the roster flattened. */
const ALL_SIZES: readonly number[] = FLEET_SPEC.flatMap((spec) =>
  Array.from({ length: spec.count }, () => spec.size),
);

/** How many fleets to deal before choosing. */
const TRIES = 12;

/**
 * How exposed each square is on an untouched board: the number of berths of the
 * whole fleet passing through it, which is what a hunter's first map looks like.
 * The board never changes, so this is worked out once.
 */
let exposure: readonly number[] | null = null;

export function exposureMap(): readonly number[] {
  if (!exposure) {
    const blank: CellState[] = new Array<CellState>(CELLS).fill('unknown');
    exposure = densityMap(blank, ALL_SIZES);
  }
  return exposure;
}

/** The total exposure of every deck of a fleet — lower is better hidden. */
export function exposureOf(board: Board): number {
  const map = exposureMap();
  let total = 0;
  for (const ship of board.ships) {
    for (const cell of ship.cells) total += map[cell];
  }
  return total;
}

/** A legal deployment, drawn to sit in colder water than an even draw would. */
export function hiddenBoard(rng: Rng, side: Side, tries = TRIES): Board {
  let best = randomBoard(rng, side);
  let coldest = exposureOf(best);

  for (let i = 1; i < tries; i++) {
    const candidate = randomBoard(rng, side);
    const exposed = exposureOf(candidate);
    if (exposed < coldest) {
      coldest = exposed;
      best = candidate;
    }
  }

  return best;
}
