import { Orientation } from './grid';

/**
 * The fleet roster of Russian-style sea battle: one battleship, two cruisers,
 * three destroyers, four patrol boats. Ten pennants, twenty decks.
 *
 * A class is identified by its length alone. What that length is called is a
 * matter of language and lives in `i18n` — the rules only ever count decks.
 */

export interface ShipClass {
  size: number;
  count: number;
}

export const FLEET_SPEC: readonly ShipClass[] = [
  { size: 4, count: 1 },
  { size: 3, count: 2 },
  { size: 2, count: 3 },
  { size: 1, count: 4 },
];

export const FLEET_SHIPS = FLEET_SPEC.reduce((n, s) => n + s.count, 0);
export const TOTAL_DECKS = FLEET_SPEC.reduce((n, s) => n + s.count * s.size, 0);

/** A ship already placed on the board. `cells` are its cells, bow first. */
export interface Ship {
  id: number;
  size: number;
  row: number;
  col: number;
  orient: Orientation;
  cells: number[];
  hits: number;
}

export const isSunk = (ship: Ship): boolean => ship.hits >= ship.size;
