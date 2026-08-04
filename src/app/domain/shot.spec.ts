import { describe, expect, it } from 'vitest';
import { Board, emptyBoard } from './board';
import { TOTAL_DECKS } from './fleet';
import { SIZE, idx } from './grid';
import { aura, canonicalBoard, randomBoard, shipCells, withShip } from './placement';
import { seededRng } from './rng';
import { afloatSizes, fire, isFleetDestroyed } from './shot';

const withOne = (row: number, col: number, size: number, orient: 'h' | 'v' = 'h'): Board =>
  withShip(emptyBoard('enemy'), row, col, size, orient);

/** Fires at a list of cells one after another and hands back the resulting board. */
const volley = (start: Board, cells: number[]): Board =>
  cells.reduce((b, c) => fire(b, c).board, start);

describe('a miss', () => {
  it('marks the cell and leaves the ships alone', () => {
    const before = withOne(5, 5, 2);
    const out = fire(before, idx(0, 0));
    expect(out.result).toBe('miss');
    expect(out.ship).toBeNull();
    expect(out.board.shots[idx(0, 0)]).toBe('miss');
    expect(out.board.ships).toEqual(before.ships);
  });

  it('the original board stays untouched', () => {
    const before = withOne(5, 5, 2);
    fire(before, idx(0, 0));
    expect(before.shots.every((s) => s === 'unknown')).toBe(true);
  });
});

describe('a hit', () => {
  it('is credited to the ship and marks the cell', () => {
    const out = fire(withOne(5, 5, 2), idx(5, 5));
    expect(out.result).toBe('hit');
    expect(out.board.shots[idx(5, 5)]).toBe('hit');
    expect(out.ship?.hits).toBe(1);
    expect(out.board.ships[0].hits).toBe(1);
  });

  it('while the ship is still whole the result is "hit", not "sunk"', () => {
    const b = fire(withOne(0, 0, 4), idx(0, 0)).board;
    const out = fire(b, idx(0, 1));
    expect(out.result).toBe('hit');
    expect(out.board.ships[0].hits).toBe(2);
  });

  it('the neighbouring ships are not touched', () => {
    let b = withOne(0, 0, 2);
    b = withShip(b, 5, 5, 3, 'h');
    const out = fire(b, idx(0, 0));
    expect(out.board.ships.find((s) => s.size === 3)?.hits).toBe(0);
  });
});

describe('sinking', () => {
  it('a single-decker goes down with the very first shot', () => {
    const out = fire(withOne(5, 5, 1), idx(5, 5));
    expect(out.result).toBe('sunk');
    expect(out.ship?.size).toBe(1);
    expect(out.board.shots[idx(5, 5)]).toBe('sunk');
  });

  it('every deck is marked as sunk, not as a hit', () => {
    const cells = shipCells(3, 3, 3, 'h');
    const b = volley(withOne(3, 3, 3), cells);
    for (const c of cells) expect(b.shots[c]).toBe('sunk');
  });

  it('the ring around it is filled with misses — diagonals included', () => {
    const cells = shipCells(3, 3, 2, 'h');
    const b = volley(withOne(3, 3, 2), cells);
    for (const c of aura(cells)) expect(b.shots[c]).toBe('miss');
    expect(b.shots[idx(2, 2)]).toBe('miss');
    expect(b.shots[idx(4, 5)]).toBe('miss');
  });

  it('the ring does not run past the edge of the board', () => {
    const b = volley(withOne(0, 0, 1), [idx(0, 0)]);
    expect(b.shots.filter((s) => s === 'miss')).toHaveLength(3);
  });

  it('the ring does not overwrite cells that are already known', () => {
    // first a miss nearby, then we sink the ship — the miss stays a miss
    let b = withOne(5, 5, 1);
    b = fire(b, idx(4, 4)).board;
    b = fire(b, idx(5, 5)).board;
    expect(b.shots[idx(4, 4)]).toBe('miss');
    expect(b.shots[idx(5, 5)]).toBe('sunk');
  });

  it('the ring does not touch the cells of a neighbouring sunk ship', () => {
    let b = withOne(0, 0, 1);
    b = withShip(b, 0, 2, 1, 'h');
    b = fire(b, idx(0, 0)).board;
    b = fire(b, idx(0, 2)).board;
    expect(b.shots[idx(0, 0)]).toBe('sunk');
    expect(b.shots[idx(0, 2)]).toBe('sunk');
  });
});

describe('isFleetDestroyed', () => {
  it('an empty board does not count as wiped out — there is nothing to sink', () => {
    expect(isFleetDestroyed(emptyBoard('enemy'))).toBe(false);
  });

  it('while even one ship is afloat — no', () => {
    let b = withOne(0, 0, 1);
    b = withShip(b, 5, 5, 1, 'h');
    b = fire(b, idx(0, 0)).board;
    expect(isFleetDestroyed(b)).toBe(false);
  });

  it('once they are all sunk — yes', () => {
    let b = withOne(0, 0, 1);
    b = withShip(b, 5, 5, 1, 'h');
    b = fire(b, idx(0, 0)).board;
    b = fire(b, idx(5, 5)).board;
    expect(isFleetDestroyed(b)).toBe(true);
  });
});

describe('afloatSizes', () => {
  it('for an intact fleet it lists every ship size', () => {
    const sizes = afloatSizes(canonicalBoard('enemy')).sort((a, b) => b - a);
    expect(sizes).toEqual([4, 3, 3, 2, 2, 2, 1, 1, 1, 1]);
  });

  it('a sunk ship leaves the list, a wounded one stays at its full size', () => {
    let b = withOne(0, 0, 2);
    b = withShip(b, 5, 5, 3, 'h');
    b = fire(b, idx(5, 5)).board; // wounded the three-decker
    expect(afloatSizes(b).sort((a, x) => x - a)).toEqual([3, 2]);

    b = volley(b, shipCells(0, 0, 2, 'h')); // sank the two-decker
    expect(afloatSizes(b)).toEqual([3]);
  });
});

describe('a whole game', () => {
  it('shooting up the entire board sinks the fleet and breaks no invariants', () => {
    const start = randomBoard(seededRng(4242), 'enemy');
    let b = start;
    let shots = 0;

    for (let cell = 0; cell < SIZE * SIZE; cell++) {
      if (b.shots[cell] !== 'unknown') continue;
      b = fire(b, cell).board;
      shots++;
    }

    expect(isFleetDestroyed(b)).toBe(true);
    expect(afloatSizes(b)).toEqual([]);
    expect(shots).toBeLessThanOrEqual(SIZE * SIZE);

    // every ship cell is marked as sunk, every empty one as a miss
    for (let cell = 0; cell < SIZE * SIZE; cell++) {
      expect(b.shots[cell]).toBe(start.shipAt[cell] === -1 ? 'miss' : 'sunk');
    }
    expect(b.ships.reduce((n, s) => n + s.hits, 0)).toBe(TOTAL_DECKS);
  });

  it('ringing sunk ships saves shots: it takes fewer than a hundred', () => {
    let b = randomBoard(seededRng(7), 'enemy');
    let shots = 0;
    for (let cell = 0; cell < SIZE * SIZE; cell++) {
      if (b.shots[cell] !== 'unknown') continue;
      b = fire(b, cell).board;
      shots++;
    }
    expect(shots).toBeLessThan(SIZE * SIZE);
  });
});
