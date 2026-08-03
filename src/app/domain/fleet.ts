import { Orientation } from './grid';

/**
 * Состав флота в русском морском бою: один линкор, два крейсера, три эсминца,
 * четыре катера. Десять вымпелов, двадцать палуб.
 */

export interface ShipClass {
  size: number;
  count: number;
  name: string;
}

export const FLEET_SPEC: readonly ShipClass[] = [
  { size: 4, count: 1, name: 'Линкор' },
  { size: 3, count: 2, name: 'Крейсер' },
  { size: 2, count: 3, name: 'Эсминец' },
  { size: 1, count: 4, name: 'Катер' },
];

export const FLEET_SHIPS = FLEET_SPEC.reduce((n, s) => n + s.count, 0);
export const TOTAL_DECKS = FLEET_SPEC.reduce((n, s) => n + s.count * s.size, 0);

export function shipName(size: number): string {
  return FLEET_SPEC.find((s) => s.size === size)?.name ?? 'Корабль';
}

/** Корабль, уже поставленный на поле. `cells` — его клетки в порядке от носа. */
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
