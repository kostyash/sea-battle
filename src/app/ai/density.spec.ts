import { describe, expect, it } from 'vitest';
import { CellState } from '../domain/board';
import { CELLS, colOf, idx, rowOf } from '../domain/grid';
import { seededRng } from '../domain/rng';
import { densityMap, densityShot, touchesForeignHit } from './density';
import { chooseShot } from './opponent';

const FULL_FLEET = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];

const blank = (): CellState[] => new Array<CellState>(CELLS).fill('unknown');

const withMarks = (marks: Record<number, CellState>): CellState[] => {
  const shots = blank();
  for (const [cell, state] of Object.entries(marks)) shots[Number(cell)] = state;
  return shots;
};

const openCells = (shots: readonly CellState[]): number[] => {
  const out: number[] = [];
  for (let i = 0; i < CELLS; i++) if (shots[i] === 'unknown') out.push(i);
  return out;
};

describe('density map', () => {
  it('on an empty board the middle is worth more than a corner — more ships fit there', () => {
    const score = densityMap(blank(), FULL_FLEET);
    expect(score[idx(4, 4)]).toBeGreaterThan(score[idx(0, 0)]);
    expect(score[idx(4, 4)]).toBeGreaterThan(score[idx(0, 5)]);
  });

  it('on an empty board the map is symmetric', () => {
    const score = densityMap(blank(), FULL_FLEET);
    expect(score[idx(0, 0)]).toBe(score[idx(9, 9)]);
    expect(score[idx(0, 3)]).toBe(score[idx(9, 6)]);
    expect(score[idx(2, 7)]).toBe(score[idx(7, 2)]);
  });

  it('a miss zeroes its own cell and drags the neighbouring ones down', () => {
    const clean = densityMap(blank(), FULL_FLEET);
    const score = densityMap(withMarks({ [idx(4, 4)]: 'miss' }), FULL_FLEET);
    expect(score[idx(4, 4)]).toBe(0);
    expect(score[idx(4, 5)]).toBeLessThan(clean[idx(4, 5)]);
  });

  it('a sunk cell blocks placements just the same', () => {
    const score = densityMap(withMarks({ [idx(4, 4)]: 'sunk' }), FULL_FLEET);
    expect(score[idx(4, 4)]).toBe(0);
  });

  it('a single open hit draws the whole map onto the wounded ship', () => {
    const score = densityMap(withMarks({ [idx(4, 4)]: 'hit' }), FULL_FLEET);
    // only the cells that continue the wounded ship get any weight
    expect(score[idx(4, 5)]).toBeGreaterThan(0);
    expect(score[idx(0, 0)]).toBe(0);
  });

  it('a wounded line values its own ends higher than its flanks', () => {
    const shots = withMarks({ [idx(5, 4)]: 'hit', [idx(5, 5)]: 'hit' });
    const score = densityMap(shots, FULL_FLEET);
    expect(score[idx(5, 3)]).toBeGreaterThan(0);
    expect(score[idx(5, 6)]).toBeGreaterThan(0);
    // the ship cannot turn sideways — it would end up touching itself
    expect(score[idx(4, 4)]).toBe(0);
    expect(score[idx(6, 5)]).toBe(0);
  });

  it('a ship size that does not fit into a gap brings no weight to it', () => {
    // A gap three wide horizontally: columns 5..7, fenced off by misses.
    // It has to be closed vertically too, or the four-decker would stand across it.
    const walls: Record<number, CellState> = {};
    for (let r = 0; r < 10; r++) {
      walls[idx(r, 4)] = 'miss';
      walls[idx(r, 8)] = 'miss';
    }
    for (let c = 5; c <= 7; c++) {
      walls[idx(1, c)] = 'miss';
    }
    const shots = withMarks(walls);
    const gap = idx(0, 6); // middle of the 3x1 gap in the top row

    // a three-decker fits in here; a four-decker has no room either along or across
    expect(densityMap(shots, [3])[gap]).toBeGreaterThan(0);
    expect(densityMap(shots, [4])[gap]).toBe(0);
  });

  it('the more ships of one size are still afloat, the heavier a cell weighs', () => {
    const one = densityMap(blank(), [3])[idx(4, 4)];
    const two = densityMap(blank(), [3, 3])[idx(4, 4)];
    expect(two).toBe(one * 2);
  });

  it('an empty list of ship sizes gives an all-zero map', () => {
    expect(densityMap(blank(), []).every((v) => v === 0)).toBe(true);
  });
});

describe('touchesForeignHit', () => {
  it('sees a foreign open hit alongside', () => {
    const shots = withMarks({ [idx(5, 5)]: 'hit' });
    expect(touchesForeignHit(shots, [idx(5, 6)])).toBe(true);
  });

  it('sees a foreign open hit diagonally — ships never touch corner to corner', () => {
    const shots = withMarks({ [idx(5, 5)]: 'hit' });
    expect(touchesForeignHit(shots, [idx(6, 6)])).toBe(true);
  });

  it('does not count an open hit inside its own hull as foreign', () => {
    const shots = withMarks({ [idx(5, 5)]: 'hit' });
    expect(touchesForeignHit(shots, [idx(5, 5), idx(5, 6)])).toBe(false);
  });

  it('one cell apart is no longer a touch', () => {
    const shots = withMarks({ [idx(5, 5)]: 'hit' });
    expect(touchesForeignHit(shots, [idx(5, 7)])).toBe(false);
  });

  it('at the edge of the board it does not run past the boundary', () => {
    const shots = withMarks({ [idx(0, 0)]: 'hit' });
    expect(touchesForeignHit(shots, [idx(0, 2)])).toBe(false);
    expect(touchesForeignHit(shots, [idx(1, 1)])).toBe(true);
  });
});

describe('choosing a shot by density', () => {
  it('fires at the cell with the highest weight', () => {
    const shots = blank();
    const score = densityMap(shots, FULL_FLEET);
    const best = Math.max(...score);
    const cell = densityShot(shots, FULL_FLEET, openCells(shots), seededRng(1));
    expect(score[cell]).toBe(best);
  });

  it('a wounded ship gets finished off instead of being abandoned', () => {
    const shots = withMarks({ [idx(5, 5)]: 'hit' });
    for (const seed of [1, 2, 3, 4, 5]) {
      const cell = densityShot(shots, FULL_FLEET, openCells(shots), seededRng(seed));
      expect([idx(4, 5), idx(6, 5), idx(5, 4), idx(5, 6)]).toContain(cell);
    }
  });

  it('when not a single placement adds up, it honestly returns -1', () => {
    // there is an open hit, but everything around it is closed: nowhere to continue the ship
    const shots = withMarks({
      [idx(5, 5)]: 'hit',
      [idx(4, 5)]: 'miss',
      [idx(6, 5)]: 'miss',
      [idx(5, 4)]: 'miss',
      [idx(5, 6)]: 'miss',
    });
    expect(densityShot(shots, FULL_FLEET, openCells(shots), seededRng(1))).toBe(-1);
  });

  it('in that dead end the Admiral does not stall — he drops into the Midshipman search', () => {
    const shots = withMarks({
      [idx(5, 5)]: 'hit',
      [idx(4, 5)]: 'miss',
      [idx(6, 5)]: 'miss',
      [idx(5, 4)]: 'miss',
      [idx(5, 6)]: 'miss',
    });
    const cell = chooseShot(shots, FULL_FLEET, 'admiral', seededRng(1));
    expect(cell).toBeGreaterThanOrEqual(0);
    expect(shots[cell]).toBe('unknown');
  });

  it('the first move goes on a black square — that is how the density falls', () => {
    const cell = chooseShot(blank(), FULL_FLEET, 'admiral', seededRng(1));
    expect((rowOf(cell) + colOf(cell)) % 2).toBe(0);
  });

  it('never picks a cell that has already been shot at', () => {
    const rng = seededRng(31);
    const shots = blank();
    for (let n = 0; n < 60; n++) {
      const cell = chooseShot(shots, FULL_FLEET, 'admiral', rng);
      expect(shots[cell]).toBe('unknown');
      shots[cell] = 'miss';
    }
  });
});
