import { Board, emptyBoard } from './board';
import { FLEET_SPEC, Ship } from './fleet';
import { Orientation, SIZE, Side, colOf, idx, inBounds, rowOf } from './grid';
import { Rng } from './rng';

/**
 * Fleet deployment.
 *
 * The main rule of Russian sea battle: ships never touch — neither side by side
 * nor corner to corner. Everything else follows: the legality check, the ring of
 * misses around a sunk ship, and why the opponent may cross out the cells around
 * a find.
 */

/** The ship's cells starting at the bow; empty array if it does not fit the square. */
export function shipCells(row: number, col: number, size: number, orient: Orientation): number[] {
  const cells: number[] = [];
  for (let k = 0; k < size; k++) {
    const r = orient === 'v' ? row + k : row;
    const c = orient === 'h' ? col + k : col;
    if (!inBounds(r, c)) return [];
    cells.push(idx(r, c));
  }
  return cells;
}

/** The same cells, but clipped at the edge — for the translucent silhouette under the cursor. */
export function clippedCells(
  row: number,
  col: number,
  size: number,
  orient: Orientation,
): number[] {
  const cells: number[] = [];
  for (let k = 0; k < size; k++) {
    const r = orient === 'v' ? row + k : row;
    const c = orient === 'h' ? col + k : col;
    if (inBounds(r, c)) cells.push(idx(r, c));
  }
  return cells;
}

/** The ring around a ship, diagonals included: nothing may stand there. */
export function aura(cells: readonly number[]): number[] {
  const own = new Set(cells);
  const ring = new Set<number>();
  for (const c of cells) {
    const r = rowOf(c);
    const k = colOf(c);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dk = -1; dk <= 1; dk++) {
        const nr = r + dr;
        const nk = k + dk;
        if (!inBounds(nr, nk)) continue;
        const n = idx(nr, nk);
        if (!own.has(n)) ring.add(n);
      }
    }
  }
  return [...ring];
}

export function canPlace(
  board: Board,
  row: number,
  col: number,
  size: number,
  orient: Orientation,
): boolean {
  const cells = shipCells(row, col, size, orient);
  if (!cells.length) return false;
  if (cells.some((c) => board.shipAt[c] !== -1)) return false;
  return !aura(cells).some((c) => board.shipAt[c] !== -1);
}

export function withShip(
  board: Board,
  row: number,
  col: number,
  size: number,
  orient: Orientation,
): Board {
  const cells = shipCells(row, col, size, orient);
  const id = board.ships.length ? Math.max(...board.ships.map((s) => s.id)) + 1 : 0;
  const ship: Ship = { id, size, row, col, orient, cells, hits: 0 };
  const shipAt = board.shipAt.slice();
  for (const c of cells) shipAt[c] = id;
  return { ...board, ships: [...board.ships, ship], shipAt };
}

export function withoutShipAt(board: Board, cell: number): Board {
  const id = board.shipAt[cell];
  if (id === -1) return board;
  const ship = board.ships.find((s) => s.id === id);
  if (!ship) return board;
  const shipAt = board.shipAt.slice();
  for (const c of ship.cells) shipAt[c] = -1;
  return { ...board, ships: board.ships.filter((s) => s.id !== id), shipAt };
}

/** Every legal placement of a ship of the given size on the current board. */
export function legalSpots(board: Board, size: number): [number, number, Orientation][] {
  const spots: [number, number, Orientation][] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (canPlace(board, r, c, size, 'h')) spots.push([r, c, 'h']);
      // a single-deck ship placed vertically is the same ship — don't offer it twice
      if (size > 1 && canPlace(board, r, c, size, 'v')) spots.push([r, c, 'v']);
    }
  }
  return spots;
}

/**
 * A random but always legal deployment: the big ships go down first, otherwise
 * the small fry fragments the board and the battleship has no straight run left.
 *
 * `attempts` — how many times to lay the fleet out again if the random draw
 * paints itself into a corner. On an empty 10×10 board, going from big to small,
 * a dead end is all but unreachable, yet the headroom is needed — and with zero
 * headroom you get to see what the fallback path does.
 */
export function randomBoard(rng: Rng, owner: Side, attempts = 300): Board {
  attempt: for (let tries = 0; tries < attempts; tries++) {
    let board = emptyBoard(owner);
    for (const spec of FLEET_SPEC) {
      for (let n = 0; n < spec.count; n++) {
        const spots = legalSpots(board, spec.size);
        if (!spots.length) continue attempt;
        const [r, c, o] = rng.pick(spots);
        board = withShip(board, r, c, spec.size, o);
      }
    }
    return board;
  }
  return canonicalBoard(owner);
}

/**
 * The fallback deployment, in case the random draw hits a dead end 300 times.
 * An empty board will not do here: a fleet of zero ships can never be sunk.
 */
const CANONICAL: readonly [number, number, number, Orientation][] = [
  [0, 0, 4, 'h'],
  [0, 5, 3, 'h'],
  [2, 0, 3, 'h'],
  [2, 4, 2, 'h'],
  [2, 7, 2, 'h'],
  [4, 0, 2, 'h'],
  [4, 3, 1, 'h'],
  [4, 5, 1, 'h'],
  [4, 7, 1, 'h'],
  [4, 9, 1, 'h'],
];

export function canonicalBoard(owner: Side): Board {
  let board = emptyBoard(owner);
  for (const [r, c, size, o] of CANONICAL) board = withShip(board, r, c, size, o);
  return board;
}
