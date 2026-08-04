import { describe, expect, it } from 'vitest';
import { CELLS, SIZE, colOf, idx, inBounds, rowOf } from './grid';

const everyCell = Array.from({ length: CELLS }, (_, i) => i);

describe('the size of the square', () => {
  it('ten by ten — a hundred cells', () => {
    expect(SIZE).toBe(10);
    expect(CELLS).toBe(100);
  });
});

describe('addressing a cell', () => {
  it('idx and rowOf/colOf invert each other across the whole board', () => {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = idx(r, c);
        expect(rowOf(cell)).toBe(r);
        expect(colOf(cell)).toBe(c);
      }
    }
  });

  it('the numbers run row by row from 0 to 99', () => {
    expect(idx(0, 0)).toBe(0);
    expect(idx(0, 9)).toBe(9);
    expect(idx(1, 0)).toBe(10);
    expect(idx(9, 9)).toBe(99);
  });

  it('every cell of the board gets a number of its own, exactly once', () => {
    const all = new Set<number>();
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) all.add(idx(r, c));
    expect(all.size).toBe(CELLS);
    expect([...all].sort((a, b) => a - b)).toEqual(everyCell);
  });
});

describe('inBounds', () => {
  it('lets every cell of the board through', () => {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) expect(inBounds(r, c)).toBe(true);
  });

  it('cuts off a step past each of the four edges', () => {
    expect(inBounds(-1, 0)).toBe(false);
    expect(inBounds(SIZE, 0)).toBe(false);
    expect(inBounds(0, -1)).toBe(false);
    expect(inBounds(0, SIZE)).toBe(false);
  });

  it('cuts off the corners that lie outside the board', () => {
    expect(inBounds(-1, -1)).toBe(false);
    expect(inBounds(SIZE, SIZE)).toBe(false);
  });
});
