import { describe, expect, it } from 'vitest';
import { emptyBoard } from './board';
import { FLEET_SHIPS, FLEET_SPEC, TOTAL_DECKS } from './fleet';
import { SIZE, colOf, idx, rowOf } from './grid';
import {
  aura,
  canPlace,
  canonicalBoard,
  clippedCells,
  legalSpots,
  randomBoard,
  shipCells,
  withShip,
  withoutShipAt,
} from './placement';
import { seededRng } from './rng';

const board = () => emptyBoard('player');

describe('shipCells', () => {
  it('lays the ship out along a row, starting from the bow', () => {
    expect(shipCells(0, 0, 4, 'h')).toEqual([0, 1, 2, 3]);
  });

  it('lays the ship out along a column', () => {
    expect(shipCells(0, 0, 3, 'v')).toEqual([0, 10, 20]);
  });

  it('a single-decker is one cell — orientation does not matter', () => {
    expect(shipCells(4, 5, 1, 'h')).toEqual([45]);
    expect(shipCells(4, 5, 1, 'v')).toEqual([45]);
  });

  it('flush against the right and the bottom edge it still fits', () => {
    expect(shipCells(0, 6, 4, 'h')).toEqual([6, 7, 8, 9]);
    expect(shipCells(6, 0, 4, 'v')).toEqual([60, 70, 80, 90]);
  });

  it('past the edge it does not fit — an empty list', () => {
    expect(shipCells(0, 7, 4, 'h')).toEqual([]);
    expect(shipCells(7, 0, 4, 'v')).toEqual([]);
    expect(shipCells(-1, 0, 2, 'h')).toEqual([]);
    expect(shipCells(0, -1, 2, 'h')).toEqual([]);
  });
});

describe('clippedCells', () => {
  it('inside the board it agrees with shipCells', () => {
    expect(clippedCells(3, 3, 3, 'h')).toEqual(shipCells(3, 3, 3, 'h'));
  });

  it('at the edge it gives back only the cells that landed, not emptiness', () => {
    expect(clippedCells(0, 8, 4, 'h')).toEqual([8, 9]);
    expect(clippedCells(8, 0, 4, 'v')).toEqual([80, 90]);
  });

  it('entirely off the board — empty', () => {
    expect(clippedCells(-3, 0, 2, 'v')).toEqual([]);
  });
});

describe('aura', () => {
  it('a cell in the middle of the board has eight neighbours around it', () => {
    const ring = aura([idx(5, 5)]);
    expect(ring).toHaveLength(8);
    expect(ring).not.toContain(idx(5, 5));
  });

  it('in a corner there are only three neighbours', () => {
    expect(aura([idx(0, 0)]).sort((a, b) => a - b)).toEqual([idx(0, 1), idx(1, 0), idx(1, 1)]);
  });

  it('the ring around a two-decker includes the diagonals and excludes the ship itself', () => {
    const cells = shipCells(5, 5, 2, 'h');
    const ring = aura(cells);
    expect(ring).toHaveLength(10);
    for (const c of cells) expect(ring).not.toContain(c);
    expect(ring).toContain(idx(4, 4));
    expect(ring).toContain(idx(6, 7));
  });

  it('every cell of the ring appears exactly once', () => {
    const ring = aura(shipCells(2, 2, 4, 'h'));
    expect(new Set(ring).size).toBe(ring.length);
  });
});

describe('canPlace', () => {
  it('on an empty board it goes anywhere within the square', () => {
    expect(canPlace(board(), 0, 0, 4, 'h')).toBe(true);
    expect(canPlace(board(), 9, 9, 1, 'h')).toBe(true);
  });

  it('it does not go past the edge', () => {
    expect(canPlace(board(), 0, 7, 4, 'h')).toBe(false);
  });

  it('it does not go on top of another ship', () => {
    const b = withShip(board(), 5, 5, 2, 'h');
    expect(canPlace(b, 5, 5, 1, 'h')).toBe(false);
    expect(canPlace(b, 5, 6, 1, 'h')).toBe(false);
  });

  it('it does not go side by side with another ship', () => {
    const b = withShip(board(), 5, 5, 2, 'h');
    expect(canPlace(b, 5, 4, 1, 'h')).toBe(false); // to the left
    expect(canPlace(b, 5, 7, 1, 'h')).toBe(false); // to the right
    expect(canPlace(b, 4, 5, 1, 'h')).toBe(false); // above
    expect(canPlace(b, 6, 6, 1, 'h')).toBe(false); // below
  });

  it('corner to corner is out too — the main rule of the game', () => {
    const b = withShip(board(), 5, 5, 1, 'h');
    for (const [dr, dc] of [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ] as const) {
      expect(canPlace(b, 5 + dr, 5 + dc, 1, 'h')).toBe(false);
    }
  });

  it('one cell apart is already allowed', () => {
    const b = withShip(board(), 5, 5, 1, 'h');
    expect(canPlace(b, 5, 7, 1, 'h')).toBe(true);
    expect(canPlace(b, 7, 5, 1, 'h')).toBe(true);
    expect(canPlace(b, 3, 3, 1, 'h')).toBe(true);
  });

  it('a long ship is rejected if even one of its decks brushes another hull', () => {
    const b = withShip(board(), 0, 0, 1, 'h');
    expect(canPlace(b, 1, 1, 4, 'h')).toBe(false);
    expect(canPlace(b, 2, 0, 4, 'h')).toBe(true);
  });
});

describe('withShip and withoutShipAt', () => {
  it('placing a ship does not touch the original board', () => {
    const before = board();
    const after = withShip(before, 0, 0, 3, 'h');
    expect(before.ships).toHaveLength(0);
    expect(before.shipAt.every((v) => v === -1)).toBe(true);
    expect(after.ships).toHaveLength(1);
  });

  it('shipAt is filled in with the id of the ship', () => {
    const b = withShip(board(), 2, 3, 3, 'h');
    const ship = b.ships[0];
    for (const c of ship.cells) expect(b.shipAt[c]).toBe(ship.id);
    expect(b.shipAt.filter((v) => v !== -1)).toHaveLength(3);
  });

  it('removal clears exactly the cells of that one ship', () => {
    let b = withShip(board(), 0, 0, 2, 'h');
    b = withShip(b, 5, 5, 3, 'h');
    const removed = withoutShipAt(b, 1);
    expect(removed.ships).toHaveLength(1);
    expect(removed.shipAt[0]).toBe(-1);
    expect(removed.shipAt[1]).toBe(-1);
    expect(removed.shipAt[55]).not.toBe(-1);
  });

  it('a ship can be removed by any of its decks, not only by the bow', () => {
    const b = withShip(board(), 0, 0, 4, 'h');
    expect(withoutShipAt(b, 3).ships).toHaveLength(0);
  });

  it('removing from an empty cell changes nothing', () => {
    const b = withShip(board(), 0, 0, 2, 'h');
    expect(withoutShipAt(b, 55)).toBe(b);
  });

  it('a dangling reference in shipAt does not break removal', () => {
    const b = withShip(board(), 0, 0, 2, 'h');
    const corrupted = { ...b, ships: [] };
    expect(withoutShipAt(corrupted, 0)).toBe(corrupted);
  });

  it('ids are not reused after removal — otherwise shipAt would point at the wrong ship', () => {
    let b = withShip(board(), 0, 0, 1, 'h');
    b = withShip(b, 0, 2, 1, 'h');
    b = withShip(b, 0, 4, 1, 'h');
    expect(b.ships.map((s) => s.id)).toEqual([0, 1, 2]);

    b = withoutShipAt(b, idx(0, 2));
    b = withShip(b, 0, 6, 1, 'h');
    expect(b.ships.map((s) => s.id)).toEqual([0, 2, 3]);

    // every occupied cell points at a ship that really exists
    for (let c = 0; c < b.shipAt.length; c++) {
      if (b.shipAt[c] === -1) continue;
      expect(b.ships.find((s) => s.id === b.shipAt[c])?.cells).toContain(c);
    }
  });
});

describe('legalSpots', () => {
  it('on an empty board a single-decker fits every cell and exactly once', () => {
    const spots = legalSpots(board(), 1);
    expect(spots).toHaveLength(100);
    expect(spots.every(([, , o]) => o === 'h')).toBe(true);
  });

  it('for a multi-decker it counts both orientations', () => {
    // 7 starts per row × 10 rows, and just as many down the columns
    expect(legalSpots(board(), 4)).toHaveLength(70 + 70);
  });

  it('an occupied board shortens the list', () => {
    const b = withShip(board(), 0, 0, 1, 'h');
    expect(legalSpots(b, 1).length).toBeLessThan(100);
  });
});

/** Full check that a deployment is legal by the rules of the game. */
function violations(cells: readonly number[][], shipAt: readonly number[]): string[] {
  const bad: string[] = [];
  const seen = new Set<number>();
  for (const ship of cells) {
    for (const c of ship) {
      if (seen.has(c)) bad.push(`cell ${c} is occupied twice`);
      seen.add(c);
    }
    const own = new Set(ship);
    for (const c of ship) {
      const r = rowOf(c);
      const k = colOf(c);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dk = -1; dk <= 1; dk++) {
          const nr = r + dr;
          const nk = k + dk;
          if (nr < 0 || nr >= SIZE || nk < 0 || nk >= SIZE) continue;
          const n = idx(nr, nk);
          if (!own.has(n) && shipAt[n] !== -1) bad.push(`ships touch at ${n}`);
        }
      }
    }
  }
  return bad;
}

describe('randomBoard', () => {
  it('one seed — one and the same deployment', () => {
    const a = randomBoard(seededRng(777), 'enemy');
    const b = randomBoard(seededRng(777), 'enemy');
    expect(a.shipAt).toEqual(b.shipAt);
    expect(a.ships).toEqual(b.ships);
  });

  it('different seeds give different deployments', () => {
    const a = randomBoard(seededRng(1), 'enemy');
    const b = randomBoard(seededRng(2), 'enemy');
    expect(a.shipAt).not.toEqual(b.shipAt);
  });

  it('the owner of the board is preserved', () => {
    expect(randomBoard(seededRng(5), 'player').owner).toBe('player');
    expect(randomBoard(seededRng(5), 'enemy').owner).toBe('enemy');
  });

  it('property: 1000 seeded deployments are all legal', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const b = randomBoard(seededRng(seed), 'enemy');

      expect(b.ships).toHaveLength(FLEET_SHIPS);
      expect(b.shipAt.filter((v) => v !== -1)).toHaveLength(TOTAL_DECKS);

      const bySize = new Map<number, number>();
      for (const s of b.ships) bySize.set(s.size, (bySize.get(s.size) ?? 0) + 1);
      for (const spec of FLEET_SPEC) expect(bySize.get(spec.size)).toBe(spec.count);

      for (const s of b.ships) {
        expect(s.cells).toEqual(shipCells(s.row, s.col, s.size, s.orient));
        expect(s.hits).toBe(0);
      }

      expect(violations(b.ships.map((s) => s.cells), b.shipAt)).toEqual([]);
      expect(b.shots.every((v) => v === 'unknown')).toBe(true);
    }
    // a thousand deployments with the full check take seconds even on a fast machine,
    // and all five of them on a CI runner, so the timeout is spelled out
  }, 30_000);
});

describe('randomBoard with no attempts to spare', () => {
  it('falls back to the spare deployment instead of handing back an empty board', () => {
    const b = randomBoard(seededRng(3), 'enemy', 0);
    expect(b.ships).toHaveLength(FLEET_SHIPS);
    expect(b.shipAt).toEqual(canonicalBoard('enemy').shipAt);
  });
});

describe('canonicalBoard — the spare deployment', () => {
  it('it is a full and legal fleet, not an empty board', () => {
    const b = canonicalBoard('enemy');
    expect(b.ships).toHaveLength(FLEET_SHIPS);
    expect(b.shipAt.filter((v) => v !== -1)).toHaveLength(TOTAL_DECKS);
    expect(violations(b.ships.map((s) => s.cells), b.shipAt)).toEqual([]);
  });

  it('its composition matches the regulation fleet', () => {
    const bySize = new Map<number, number>();
    for (const s of canonicalBoard('enemy').ships) bySize.set(s.size, (bySize.get(s.size) ?? 0) + 1);
    for (const spec of FLEET_SPEC) expect(bySize.get(spec.size)).toBe(spec.count);
  });
});
