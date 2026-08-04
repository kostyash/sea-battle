import { describe, expect, it } from 'vitest';
import { CellState } from '../domain/board';
import { CELLS, colOf, idx, rowOf } from '../domain/grid';
import { Rng, seededRng } from '../domain/rng';
import { DIFFICULTIES, Difficulty, levelHintKey, levelNameKey } from './levels';
import { chooseShot } from './opponent';

const LEVELS: Difficulty[] = ['cabin-boy', 'midshipman', 'admiral'];
const FULL_FLEET = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];

const blank = (): CellState[] => new Array<CellState>(CELLS).fill('unknown');

const withMarks = (marks: Record<number, CellState>): CellState[] => {
  const shots = blank();
  for (const [cell, state] of Object.entries(marks)) shots[Number(cell)] = state;
  return shots;
};

/** A generator that always yields the same value — so we read the choice, not the draw. */
const fixedRng = (value: number): Rng => ({
  next: () => value,
  int: (bound) => (bound <= 0 ? 0 : Math.floor(value * bound)),
  pick: (items) => items[Math.floor(value * items.length)],
});

describe('levels', () => {
  it('there are exactly three of them, in the order they grow harder', () => {
    expect(DIFFICULTIES).toHaveLength(3);
    expect([...DIFFICULTIES]).toEqual(LEVELS);
  });

  // What a level is called is words, and words live in the dictionaries —
  // see i18n/dictionaries.spec.ts, which holds every language to these keys.
  it('an id builds the keys its name and its hint are looked up by', () => {
    expect(DIFFICULTIES.map(levelNameKey)).toEqual([
      'level.cabin-boy.name',
      'level.midshipman.name',
      'level.admiral.name',
    ]);
    expect(DIFFICULTIES.map(levelHintKey)).toEqual([
      'level.cabin-boy.hint',
      'level.midshipman.hint',
      'level.admiral.hint',
    ]);
  });
});

describe.each(LEVELS)('requirements common to the "%s" level', (level) => {
  it('fires only at cells that have not been shot at yet', () => {
    const rng = seededRng(11);
    const shots = blank();
    for (let n = 0; n < CELLS; n++) {
      const cell = chooseShot(shots, FULL_FLEET, level, rng);
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(shots[cell]).toBe('unknown');
      shots[cell] = 'miss';
    }
  });

  it('on a board shot through and through it honestly answers -1', () => {
    const shots = new Array<CellState>(CELLS).fill('miss');
    expect(chooseShot(shots, [], level, seededRng(1))).toBe(-1);
  });

  it('does not fall over when no ship sizes are left afloat', () => {
    const cell = chooseShot(blank(), [], level, seededRng(3));
    expect(cell).toBeGreaterThanOrEqual(0);
  });

  it('one seed — one and the same cell', () => {
    const shots = withMarks({ [idx(4, 4)]: 'hit' });
    const a = chooseShot(shots, FULL_FLEET, level, seededRng(99));
    const b = chooseShot(shots, FULL_FLEET, level, seededRng(99));
    expect(a).toBe(b);
  });
});

describe('Cabin Boy', () => {
  it('a draw below the threshold finishes off a neighbouring cell', () => {
    const shots = withMarks({ [idx(5, 5)]: 'hit' });
    const cell = chooseShot(shots, FULL_FLEET, 'cabin-boy', fixedRng(0));
    expect([idx(4, 5), idx(6, 5), idx(5, 4), idx(5, 6)]).toContain(cell);
  });

  it('a draw above the threshold fires anywhere instead of finishing off', () => {
    const shots = withMarks({ [idx(5, 5)]: 'hit' });
    const cell = chooseShot(shots, FULL_FLEET, 'cabin-boy', fixedRng(0.9));
    expect([idx(4, 5), idx(6, 5), idx(5, 4), idx(5, 6)]).not.toContain(cell);
  });

  it('if every neighbour of the open hit is already shot at — he fires elsewhere', () => {
    const shots = withMarks({
      [idx(5, 5)]: 'hit',
      [idx(4, 5)]: 'miss',
      [idx(6, 5)]: 'miss',
      [idx(5, 4)]: 'miss',
      [idx(5, 6)]: 'miss',
    });
    const cell = chooseShot(shots, FULL_FLEET, 'cabin-boy', fixedRng(0));
    expect(shots[cell]).toBe('unknown');
  });
});

describe('Midshipman', () => {
  it('with no open hits he searches the black squares while a multi-decker lives', () => {
    const rng = seededRng(5);
    for (let n = 0; n < 40; n++) {
      const cell = chooseShot(blank(), FULL_FLEET, 'midshipman', rng);
      expect((rowOf(cell) + colOf(cell)) % 2).toBe(0);
    }
  });

  it('once only single-deckers are left, the every-other-cell stride is dropped', () => {
    const rng = seededRng(5);
    const parities = new Set<number>();
    for (let n = 0; n < 200; n++) {
      const cell = chooseShot(blank(), [1, 1, 1], 'midshipman', rng);
      parities.add((rowOf(cell) + colOf(cell)) % 2);
    }
    expect(parities).toEqual(new Set([0, 1]));
  });

  it('a lone open hit is finished off through its neighbours', () => {
    const shots = withMarks({ [idx(5, 5)]: 'hit' });
    const cell = chooseShot(shots, FULL_FLEET, 'midshipman', seededRng(2));
    expect([idx(4, 5), idx(6, 5), idx(5, 4), idx(5, 6)]).toContain(cell);
  });

  it('having felt out a line, he continues it from an end rather than firing sideways', () => {
    const shots = withMarks({ [idx(5, 4)]: 'hit', [idx(5, 5)]: 'hit' });
    for (const seed of [1, 2, 3, 4, 5]) {
      const cell = chooseShot(shots, FULL_FLEET, 'midshipman', seededRng(seed));
      expect([idx(5, 3), idx(5, 6)]).toContain(cell);
    }
  });

  it('he continues a vertical line just as well', () => {
    const shots = withMarks({ [idx(4, 5)]: 'hit', [idx(5, 5)]: 'hit' });
    for (const seed of [1, 2, 3]) {
      const cell = chooseShot(shots, FULL_FLEET, 'midshipman', seededRng(seed));
      expect([idx(3, 5), idx(6, 5)]).toContain(cell);
    }
  });

  it('having run into a closed end, he fires at the open one', () => {
    const shots = withMarks({
      [idx(5, 4)]: 'hit',
      [idx(5, 5)]: 'hit',
      [idx(5, 3)]: 'miss',
    });
    for (const seed of [1, 2, 3, 4]) {
      expect(chooseShot(shots, FULL_FLEET, 'midshipman', seededRng(seed))).toBe(idx(5, 6));
    }
  });

  it('a line at the edge of the board is continued inwards only', () => {
    const shots = withMarks({ [idx(0, 0)]: 'hit', [idx(0, 1)]: 'hit' });
    for (const seed of [1, 2, 3]) {
      expect(chooseShot(shots, FULL_FLEET, 'midshipman', seededRng(seed))).toBe(idx(0, 2));
    }
  });

  it('with both ends of the line closed, he goes for the neighbours of another open hit', () => {
    const shots = withMarks({
      [idx(5, 4)]: 'hit',
      [idx(5, 5)]: 'hit',
      [idx(5, 3)]: 'miss',
      [idx(5, 6)]: 'miss',
    });
    const cell = chooseShot(shots, FULL_FLEET, 'midshipman', seededRng(7));
    expect([idx(4, 4), idx(6, 4), idx(4, 5), idx(6, 5)]).toContain(cell);
  });
});
