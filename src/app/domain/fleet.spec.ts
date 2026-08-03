import { describe, expect, it } from 'vitest';
import { FLEET_SHIPS, FLEET_SPEC, FLEET_SPEC as SPEC, Ship, TOTAL_DECKS, isSunk, shipName } from './fleet';

const ship = (size: number, hits: number): Ship => ({
  id: 0,
  size,
  row: 0,
  col: 0,
  orient: 'h',
  cells: Array.from({ length: size }, (_, i) => i),
  hits,
});

describe('состав флота', () => {
  it('один линкор, два крейсера, три эсминца, четыре катера', () => {
    expect(SPEC.map((s) => [s.size, s.count])).toEqual([
      [4, 1],
      [3, 2],
      [2, 3],
      [1, 4],
    ]);
  });

  it('десять вымпелов и двадцать палуб', () => {
    expect(FLEET_SHIPS).toBe(10);
    expect(TOTAL_DECKS).toBe(20);
  });

  it('итоги сходятся с самим составом', () => {
    expect(FLEET_SPEC.reduce((n, s) => n + s.count, 0)).toBe(FLEET_SHIPS);
    expect(FLEET_SPEC.reduce((n, s) => n + s.count * s.size, 0)).toBe(TOTAL_DECKS);
  });

  it('калибры перечислены от крупного к мелкому и не повторяются', () => {
    const sizes = SPEC.map((s) => s.size);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    expect(new Set(sizes).size).toBe(sizes.length);
  });

  it('у каждого класса есть название', () => {
    for (const s of SPEC) expect(s.name.length).toBeGreaterThan(0);
  });
});

describe('shipName', () => {
  it('называет каждый калибр', () => {
    expect(shipName(4)).toBe('Линкор');
    expect(shipName(3)).toBe('Крейсер');
    expect(shipName(2)).toBe('Эсминец');
    expect(shipName(1)).toBe('Катер');
  });

  it('на неизвестный калибр отвечает общим словом, а не падает', () => {
    expect(shipName(5)).toBe('Корабль');
    expect(shipName(0)).toBe('Корабль');
  });
});

describe('isSunk', () => {
  it('целый корабль не потоплен', () => {
    expect(isSunk(ship(3, 0))).toBe(false);
    expect(isSunk(ship(3, 2))).toBe(false);
  });

  it('корабль с попаданиями по числу палуб потоплен', () => {
    expect(isSunk(ship(1, 1))).toBe(true);
    expect(isSunk(ship(4, 4))).toBe(true);
  });

  it('лишние попадания ничего не ломают', () => {
    expect(isSunk(ship(2, 3))).toBe(true);
  });
});
