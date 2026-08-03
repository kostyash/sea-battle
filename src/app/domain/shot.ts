import { Board, ShotResult } from './board';
import { Ship, isSunk } from './fleet';
import { aura } from './placement';

/**
 * Разрешение выстрела.
 *
 * Потопленный корабль сам обводит себя промахами: раз корабли не соприкасаются,
 * все соседние клетки заведомо пусты, и держать игрока в неведении незачем.
 */

export interface FireOutcome {
  board: Board;
  result: ShotResult;
  /** Корабль, в который попали; при промахе — `null`. */
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
 * Калибры, ещё держащиеся на плаву. Стреляющий знает их честно: потопление
 * объявляется вслух, так что список выводится из того же, что видит игрок.
 */
export function afloatSizes(board: Board): number[] {
  return board.ships.filter((s) => !isSunk(s)).map((s) => s.size);
}
