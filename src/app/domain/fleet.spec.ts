import { describe, expect, it } from 'vitest';
import { FLEET_SHIPS, FLEET_SPEC as SPEC, Ship, TOTAL_DECKS, isSunk } from './fleet';

const ship = (size: number, hits: number): Ship => ({
  id: 0,
  size,
  row: 0,
  col: 0,
  orient: 'h',
  cells: Array.from({ length: size }, (_, i) => i),
  hits,
});

describe('the fleet roster', () => {
  it('one four-decker, two three-deckers, three two-deckers, four single-deckers', () => {
    expect(SPEC.map((s) => [s.size, s.count])).toEqual([
      [4, 1],
      [3, 2],
      [2, 3],
      [1, 4],
    ]);
  });

  it('ten pennants and twenty decks', () => {
    expect(FLEET_SHIPS).toBe(10);
    expect(TOTAL_DECKS).toBe(20);
  });

  it('the classes run from the largest down and no length appears twice', () => {
    const sizes = SPEC.map((s) => s.size);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    expect(new Set(sizes).size).toBe(sizes.length);
  });

  it('every class is a real one — at least one deck and at least one hull', () => {
    for (const s of SPEC) {
      expect(s.size).toBeGreaterThan(0);
      expect(s.count).toBeGreaterThan(0);
    }
  });
});

describe('isSunk', () => {
  it('a ship with decks still to spare is not sunk', () => {
    expect(isSunk(ship(3, 0))).toBe(false);
    expect(isSunk(ship(3, 2))).toBe(false);
  });

  it('a ship hit as many times as it has decks is sunk', () => {
    expect(isSunk(ship(1, 1))).toBe(true);
    expect(isSunk(ship(4, 4))).toBe(true);
  });

  it('hits beyond the deck count break nothing', () => {
    expect(isSunk(ship(2, 3))).toBe(true);
  });
});
