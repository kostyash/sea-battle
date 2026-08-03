/**
 * Квадрат 10×10 и адресация клеток.
 *
 * Клетка везде хранится одним числом 0…99 — так дешевле сравнивать и складывать
 * в множества. Строка и столбец выводятся из него, а не наоборот.
 */

export const SIZE = 10;
export const CELLS = SIZE * SIZE;

/** Ряды подписываются кириллицей без Ё и Й — как на бумажном бланке. */
export const ROW_LABELS = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'] as const;
export const COL_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;

/** Корабль лежит вдоль строки (`h`) или поперёк, вдоль столбца (`v`). */
export type Orientation = 'h' | 'v';

export type Side = 'player' | 'enemy';

export const idx = (row: number, col: number): number => row * SIZE + col;
export const rowOf = (cell: number): number => Math.floor(cell / SIZE);
export const colOf = (cell: number): number => cell % SIZE;

export const inBounds = (row: number, col: number): boolean =>
  row >= 0 && row < SIZE && col >= 0 && col < SIZE;

/** «Б4» — так игрок диктует координату вслух. */
export function coordLabel(cell: number): string {
  return `${ROW_LABELS[rowOf(cell)]}${COL_LABELS[colOf(cell)]}`;
}
