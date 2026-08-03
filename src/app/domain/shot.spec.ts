import { describe, expect, it } from 'vitest';
import { Board, emptyBoard } from './board';
import { TOTAL_DECKS } from './fleet';
import { SIZE, idx } from './grid';
import { aura, canonicalBoard, randomBoard, shipCells, withShip } from './placement';
import { seededRng } from './rng';
import { afloatSizes, fire, isFleetDestroyed } from './shot';

const withOne = (row: number, col: number, size: number, orient: 'h' | 'v' = 'h'): Board =>
  withShip(emptyBoard('enemy'), row, col, size, orient);

/** Бьёт по списку клеток подряд и отдаёт итоговое поле. */
const volley = (start: Board, cells: number[]): Board =>
  cells.reduce((b, c) => fire(b, c).board, start);

describe('промах', () => {
  it('помечает клетку и не трогает корабли', () => {
    const before = withOne(5, 5, 2);
    const out = fire(before, idx(0, 0));
    expect(out.result).toBe('miss');
    expect(out.ship).toBeNull();
    expect(out.board.shots[idx(0, 0)]).toBe('miss');
    expect(out.board.ships).toEqual(before.ships);
  });

  it('исходное поле остаётся нетронутым', () => {
    const before = withOne(5, 5, 2);
    fire(before, idx(0, 0));
    expect(before.shots.every((s) => s === 'unknown')).toBe(true);
  });
});

describe('попадание', () => {
  it('засчитывается кораблю и помечает клетку', () => {
    const out = fire(withOne(5, 5, 2), idx(5, 5));
    expect(out.result).toBe('hit');
    expect(out.board.shots[idx(5, 5)]).toBe('hit');
    expect(out.ship?.hits).toBe(1);
    expect(out.board.ships[0].hits).toBe(1);
  });

  it('пока цел — результат «попадание», а не «потоплен»', () => {
    const b = fire(withOne(0, 0, 4), idx(0, 0)).board;
    const out = fire(b, idx(0, 1));
    expect(out.result).toBe('hit');
    expect(out.board.ships[0].hits).toBe(2);
  });

  it('соседние корабли не задеваются', () => {
    let b = withOne(0, 0, 2);
    b = withShip(b, 5, 5, 3, 'h');
    const out = fire(b, idx(0, 0));
    expect(out.board.ships.find((s) => s.size === 3)?.hits).toBe(0);
  });
});

describe('потопление', () => {
  it('однопалубный тонет с первого выстрела', () => {
    const out = fire(withOne(5, 5, 1), idx(5, 5));
    expect(out.result).toBe('sunk');
    expect(out.ship?.size).toBe(1);
    expect(out.board.shots[idx(5, 5)]).toBe('sunk');
  });

  it('все палубы помечаются как потопленные, а не как попадания', () => {
    const cells = shipCells(3, 3, 3, 'h');
    const b = volley(withOne(3, 3, 3), cells);
    for (const c of cells) expect(b.shots[c]).toBe('sunk');
  });

  it('кольцо вокруг обводится промахами — включая диагонали', () => {
    const cells = shipCells(3, 3, 2, 'h');
    const b = volley(withOne(3, 3, 2), cells);
    for (const c of aura(cells)) expect(b.shots[c]).toBe('miss');
    expect(b.shots[idx(2, 2)]).toBe('miss');
    expect(b.shots[idx(4, 5)]).toBe('miss');
  });

  it('обводка не выходит за край поля', () => {
    const b = volley(withOne(0, 0, 1), [idx(0, 0)]);
    expect(b.shots.filter((s) => s === 'miss')).toHaveLength(3);
  });

  it('обводка не затирает уже известные клетки', () => {
    // сначала промах рядом, потом топим — промах остаётся промахом
    let b = withOne(5, 5, 1);
    b = fire(b, idx(4, 4)).board;
    b = fire(b, idx(5, 5)).board;
    expect(b.shots[idx(4, 4)]).toBe('miss');
    expect(b.shots[idx(5, 5)]).toBe('sunk');
  });

  it('обводка не трогает клетки соседнего потопленного корабля', () => {
    let b = withOne(0, 0, 1);
    b = withShip(b, 0, 2, 1, 'h');
    b = fire(b, idx(0, 0)).board;
    b = fire(b, idx(0, 2)).board;
    expect(b.shots[idx(0, 0)]).toBe('sunk');
    expect(b.shots[idx(0, 2)]).toBe('sunk');
  });
});

describe('isFleetDestroyed', () => {
  it('пустое поле не считается разгромленным — топить нечего', () => {
    expect(isFleetDestroyed(emptyBoard('enemy'))).toBe(false);
  });

  it('пока хоть один на плаву — нет', () => {
    let b = withOne(0, 0, 1);
    b = withShip(b, 5, 5, 1, 'h');
    b = fire(b, idx(0, 0)).board;
    expect(isFleetDestroyed(b)).toBe(false);
  });

  it('когда все потоплены — да', () => {
    let b = withOne(0, 0, 1);
    b = withShip(b, 5, 5, 1, 'h');
    b = fire(b, idx(0, 0)).board;
    b = fire(b, idx(5, 5)).board;
    expect(isFleetDestroyed(b)).toBe(true);
  });
});

describe('afloatSizes', () => {
  it('на целом флоте перечисляет все калибры', () => {
    const sizes = afloatSizes(canonicalBoard('enemy')).sort((a, b) => b - a);
    expect(sizes).toEqual([4, 3, 3, 2, 2, 2, 1, 1, 1, 1]);
  });

  it('потопленный уходит из списка, раненый остаётся полным калибром', () => {
    let b = withOne(0, 0, 2);
    b = withShip(b, 5, 5, 3, 'h');
    b = fire(b, idx(5, 5)).board; // ранили трёхпалубный
    expect(afloatSizes(b).sort((a, x) => x - a)).toEqual([3, 2]);

    b = volley(b, shipCells(0, 0, 2, 'h')); // утопили двухпалубный
    expect(afloatSizes(b)).toEqual([3]);
  });
});

describe('партия целиком', () => {
  it('расстрел всего поля топит флот и не ломает инварианты', () => {
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

    // каждая клетка корабля помечена потоплением, каждая пустая — промахом
    for (let cell = 0; cell < SIZE * SIZE; cell++) {
      expect(b.shots[cell]).toBe(start.shipAt[cell] === -1 ? 'miss' : 'sunk');
    }
    expect(b.ships.reduce((n, s) => n + s.hits, 0)).toBe(TOTAL_DECKS);
  });

  it('обводка потопленных экономит выстрелы: их меньше сотни', () => {
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
