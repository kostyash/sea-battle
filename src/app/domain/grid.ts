/**
 * The 10×10 square and how cells are addressed.
 *
 * A cell is stored everywhere as a single number 0…99 — cheaper to compare and
 * to put into sets. Row and column are derived from it, not the other way round.
 *
 * How a cell is spelled out for a human — “B4” — is not here on purpose: the row
 * letters belong to a language, and the rules do not have one. See `i18n/lang.ts`.
 */

export const SIZE = 10;
export const CELLS = SIZE * SIZE;

/** A ship lies along a row (`h`) or across, along a column (`v`). */
export type Orientation = 'h' | 'v';

export type Side = 'player' | 'enemy';

export const idx = (row: number, col: number): number => row * SIZE + col;
export const rowOf = (cell: number): number => Math.floor(cell / SIZE);
export const colOf = (cell: number): number => cell % SIZE;

export const inBounds = (row: number, col: number): boolean =>
  row >= 0 && row < SIZE && col >= 0 && col < SIZE;
