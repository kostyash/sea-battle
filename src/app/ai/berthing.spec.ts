import { describe, expect, it } from 'vitest';
import { FLEET_SHIPS, TOTAL_DECKS } from '../domain/fleet';
import { CELLS, SIZE, colOf, idx, rowOf } from '../domain/grid';
import { emptyBoard } from '../domain/board';
import { randomBoard, withShip } from '../domain/placement';
import { seededRng } from '../domain/rng';
import { exposureMap, exposureOf, hiddenBoard } from './berthing';

const legal = (board: ReturnType<typeof hiddenBoard>): boolean => {
  const owner = new Map<number, number>();
  for (const ship of board.ships) for (const cell of ship.cells) owner.set(cell, ship.id);
  if (owner.size !== TOTAL_DECKS) return false;

  for (const [cell, id] of owner) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = rowOf(cell) + dr;
        const c = colOf(cell) + dc;
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) continue;
        const near = owner.get(idx(r, c));
        // a neighbour belonging to another ship means they touch
        if (near !== undefined && near !== id) return false;
      }
    }
  }
  return true;
};

describe('the exposure of a square', () => {
  it('is worked out for every square of the board', () => {
    expect(exposureMap()).toHaveLength(CELLS);
  });

  it('answers the same map when asked again — it is a property of the board', () => {
    expect(exposureMap()).toBe(exposureMap());
  });

  /**
   * The whole idea rests on this: the no-touching rule leaves more room in the
   * middle, so more berths run through a middle square than through a corner,
   * and a hunter counting berths goes for the middle first.
   */
  it('is highest in the middle and lowest in the corners', () => {
    const map = exposureMap();
    expect(map[idx(4, 4)]).toBeGreaterThan(map[idx(0, 0)]);
    expect(map[idx(5, 5)]).toBeGreaterThan(map[idx(0, SIZE - 1)]);
    expect(map[idx(4, 5)]).toBeGreaterThan(map[idx(SIZE - 1, SIZE - 1)]);
  });

  it('adds up the exposure of every deck a fleet has in the water', () => {
    const middle = withShip(emptyBoard('player'), 4, 3, 4, 'h');
    const edge = withShip(emptyBoard('player'), 0, 0, 4, 'h');

    expect(exposureOf(middle)).toBeGreaterThan(exposureOf(edge));
    expect(exposureOf(emptyBoard('player'))).toBe(0);
  });
});

describe('mooring the fleet where it is hardest to find', () => {
  it('puts a whole legal fleet to sea, touching nowhere', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const board = hiddenBoard(seededRng(seed), 'enemy');
      expect(board.ships).toHaveLength(FLEET_SHIPS);
      expect(legal(board), `seed ${seed} moored an illegal fleet`).toBe(true);
    }
  });

  it('one seed — one and the same mooring', () => {
    const a = hiddenBoard(seededRng(4242), 'enemy');
    const b = hiddenBoard(seededRng(4242), 'enemy');
    expect(b.shipAt).toEqual(a.shipAt);
  });

  it('drawn only once it is an even draw, and nothing has been chosen yet', () => {
    const drawn = hiddenBoard(seededRng(99), 'enemy', 1);
    const even = randomBoard(seededRng(99), 'enemy');
    expect(drawn.shipAt).toEqual(even.shipAt);
  });

  /**
   * The point of the whole file, and the one assertion that would notice if the
   * choosing were quietly dropped: given several fleets to choose between, the
   * one that goes to sea lies in colder water than the first one dealt.
   */
  it('chooses colder water than the first fleet it dealt', () => {
    let colder = 0;
    let same = 0;

    for (let seed = 1; seed <= 40; seed++) {
      const chosen = exposureOf(hiddenBoard(seededRng(seed), 'enemy'));
      const first = exposureOf(hiddenBoard(seededRng(seed), 'enemy', 1));
      expect(chosen).toBeLessThanOrEqual(first);
      if (chosen < first) colder++;
      else same++;
    }

    // it can only tie when the first draw was already the coldest of the twelve
    expect(colder).toBeGreaterThan(same);
  });

  it('over many draws it moors further out than an even draw does', () => {
    const hidden: number[] = [];
    const even: number[] = [];
    for (let seed = 1; seed <= 60; seed++) {
      hidden.push(exposureOf(hiddenBoard(seededRng(seed), 'enemy')));
      even.push(exposureOf(randomBoard(seededRng(seed), 'enemy')));
    }
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

    expect(mean(hidden)).toBeLessThan(mean(even));
  });
});
