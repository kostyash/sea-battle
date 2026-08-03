import { describe, expect, it } from 'vitest';
import {
  CELLS,
  COL_LABELS,
  ROW_LABELS,
  SIZE,
  colOf,
  coordLabel,
  idx,
  inBounds,
  rowOf,
} from './grid';

const everyCell = Array.from({ length: CELLS }, (_, i) => i);

describe('размеры квадрата', () => {
  it('десять на десять — сто клеток', () => {
    expect(SIZE).toBe(10);
    expect(CELLS).toBe(100);
  });

  it('подписей ровно по числу рядов и столбцов', () => {
    expect(ROW_LABELS).toHaveLength(SIZE);
    expect(COL_LABELS).toHaveLength(SIZE);
  });

  it('ряды подписаны кириллицей без Ё и Й', () => {
    expect([...ROW_LABELS]).toEqual(['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К']);
    expect(ROW_LABELS).not.toContain('Ё');
    expect(ROW_LABELS).not.toContain('Й');
  });

  it('подписи рядов не повторяются', () => {
    expect(new Set(ROW_LABELS).size).toBe(SIZE);
  });
});

describe('адресация клеток', () => {
  it('idx и rowOf/colOf обратны друг другу на всём поле', () => {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = idx(r, c);
        expect(rowOf(cell)).toBe(r);
        expect(colOf(cell)).toBe(c);
      }
    }
  });

  it('номера идут построчно от 0 до 99', () => {
    expect(idx(0, 0)).toBe(0);
    expect(idx(0, 9)).toBe(9);
    expect(idx(1, 0)).toBe(10);
    expect(idx(9, 9)).toBe(99);
  });

  it('каждая клетка поля получает свой номер ровно один раз', () => {
    const all = new Set<number>();
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) all.add(idx(r, c));
    expect(all.size).toBe(CELLS);
    expect([...all].sort((a, b) => a - b)).toEqual(everyCell);
  });
});

describe('inBounds', () => {
  it('пропускает все клетки поля', () => {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) expect(inBounds(r, c)).toBe(true);
  });

  it('отсекает выход за каждую из четырёх границ', () => {
    expect(inBounds(-1, 0)).toBe(false);
    expect(inBounds(SIZE, 0)).toBe(false);
    expect(inBounds(0, -1)).toBe(false);
    expect(inBounds(0, SIZE)).toBe(false);
  });

  it('отсекает углы за полем', () => {
    expect(inBounds(-1, -1)).toBe(false);
    expect(inBounds(SIZE, SIZE)).toBe(false);
  });
});

describe('coordLabel', () => {
  it('называет углы и середину так, как их диктуют вслух', () => {
    expect(coordLabel(idx(0, 0))).toBe('А1');
    expect(coordLabel(idx(0, 9))).toBe('А10');
    expect(coordLabel(idx(1, 3))).toBe('Б4');
    expect(coordLabel(idx(9, 0))).toBe('К1');
    expect(coordLabel(idx(9, 9))).toBe('К10');
  });

  it('все сто подписей различны', () => {
    expect(new Set(everyCell.map(coordLabel)).size).toBe(CELLS);
  });

  it('подпись всегда буква ряда плюс номер столбца', () => {
    for (const cell of everyCell) {
      expect(coordLabel(cell)).toBe(`${ROW_LABELS[rowOf(cell)]}${colOf(cell) + 1}`);
    }
  });
});
