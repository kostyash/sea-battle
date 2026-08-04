import { Board, ShotResult } from './board';
import { Ship, isSunk } from './fleet';
import { aura } from './placement';

/**
 * Resolving a shot.
 *
 * A sunk ship rings itself with misses: since ships never touch, every adjacent
 * cell is known to be empty, and there is no point keeping the player in the dark.
 */

export interface FireOutcome {
  board: Board;
  result: ShotResult;
  /** The ship that was hit; `null` on a miss. */
  ship: Ship | null;
}

export function fire(board: Board, cell: number): FireOutcome {
  const shots = board.shots.slice();
  const id = board.shipAt[cell];

  if (id === -1) {
    shots[cell] = 'miss';
    return { board: { ...board, shots }, result: 'miss', ship: null };
  }

  shots[cell] = 'hit';
  const ships = board.ships.map((s) => (s.id === id ? { ...s, hits: s.hits + 1 } : s));
  const ship = ships.find((s) => s.id === id)!;

  if (!isSunk(ship)) {
    return { board: { ...board, shots, ships }, result: 'hit', ship };
  }

  for (const c of ship.cells) shots[c] = 'sunk';
  for (const c of aura(ship.cells)) if (shots[c] === 'unknown') shots[c] = 'miss';
  return { board: { ...board, shots, ships }, result: 'sunk', ship };
}

export function isFleetDestroyed(board: Board): boolean {
  return board.ships.length > 0 && board.ships.every(isSunk);
}

/**
 * The ship sizes still afloat. The shooter learns them fairly: a sinking is
 * announced out loud, so the list follows from what the player already sees.
 */
export function afloatSizes(board: Board): number[] {
  return board.ships.filter((s) => !isSunk(s)).map((s) => s.size);
}
