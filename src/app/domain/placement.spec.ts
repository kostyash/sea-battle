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
  it('раскладывает корабль вдоль строки от носа', () => {
    expect(shipCells(0, 0, 4, 'h')).toEqual([0, 1, 2, 3]);
  });

  it('раскладывает корабль вдоль столбца', () => {
    expect(shipCells(0, 0, 3, 'v')).toEqual([0, 10, 20]);
  });

  it('однопалубный — одна клетка, ориентация не важна', () => {
    expect(shipCells(4, 5, 1, 'h')).toEqual([45]);
    expect(shipCells(4, 5, 1, 'v')).toEqual([45]);
  });

  it('впритык к правому и нижнему краю ещё помещается', () => {
    expect(shipCells(0, 6, 4, 'h')).toEqual([6, 7, 8, 9]);
    expect(shipCells(6, 0, 4, 'v')).toEqual([60, 70, 80, 90]);
  });

  it('за краем не помещается — пустой список', () => {
    expect(shipCells(0, 7, 4, 'h')).toEqual([]);
    expect(shipCells(7, 0, 4, 'v')).toEqual([]);
    expect(shipCells(-1, 0, 2, 'h')).toEqual([]);
    expect(shipCells(0, -1, 2, 'h')).toEqual([]);
  });
});

describe('clippedCells', () => {
  it('внутри поля совпадает с shipCells', () => {
    expect(clippedCells(3, 3, 3, 'h')).toEqual(shipCells(3, 3, 3, 'h'));
  });

  it('на краю отдаёт только попавшие клетки, а не пустоту', () => {
    expect(clippedCells(0, 8, 4, 'h')).toEqual([8, 9]);
    expect(clippedCells(8, 0, 4, 'v')).toEqual([80, 90]);
  });

  it('целиком за полем — пусто', () => {
    expect(clippedCells(-3, 0, 2, 'v')).toEqual([]);
  });
});

describe('aura', () => {
  it('вокруг клетки в середине поля восемь соседей', () => {
    const ring = aura([idx(5, 5)]);
    expect(ring).toHaveLength(8);
    expect(ring).not.toContain(idx(5, 5));
  });

  it('в углу соседей только три', () => {
    expect(aura([idx(0, 0)]).sort((a, b) => a - b)).toEqual([idx(0, 1), idx(1, 0), idx(1, 1)]);
  });

  it('кольцо вокруг двухпалубного включает диагонали и не включает сам корабль', () => {
    const cells = shipCells(5, 5, 2, 'h');
    const ring = aura(cells);
    expect(ring).toHaveLength(10);
    for (const c of cells) expect(ring).not.toContain(c);
    expect(ring).toContain(idx(4, 4));
    expect(ring).toContain(idx(6, 7));
  });

  it('каждая клетка кольца встречается один раз', () => {
    const ring = aura(shipCells(2, 2, 4, 'h'));
    expect(new Set(ring).size).toBe(ring.length);
  });
});

describe('canPlace', () => {
  it('на пустом поле ставится куда угодно в пределах квадрата', () => {
    expect(canPlace(board(), 0, 0, 4, 'h')).toBe(true);
    expect(canPlace(board(), 9, 9, 1, 'h')).toBe(true);
  });

  it('за край не ставится', () => {
    expect(canPlace(board(), 0, 7, 4, 'h')).toBe(false);
  });

  it('поверх другого корабля не ставится', () => {
    const b = withShip(board(), 5, 5, 2, 'h');
    expect(canPlace(b, 5, 5, 1, 'h')).toBe(false);
    expect(canPlace(b, 5, 6, 1, 'h')).toBe(false);
  });

  it('борт к борту не ставится', () => {
    const b = withShip(board(), 5, 5, 2, 'h');
    expect(canPlace(b, 5, 4, 1, 'h')).toBe(false); // слева
    expect(canPlace(b, 5, 7, 1, 'h')).toBe(false); // справа
    expect(canPlace(b, 4, 5, 1, 'h')).toBe(false); // сверху
    expect(canPlace(b, 6, 6, 1, 'h')).toBe(false); // снизу
  });

  it('углом к углу тоже не ставится — главное правило', () => {
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

  it('через клетку — уже можно', () => {
    const b = withShip(board(), 5, 5, 1, 'h');
    expect(canPlace(b, 5, 7, 1, 'h')).toBe(true);
    expect(canPlace(b, 7, 5, 1, 'h')).toBe(true);
    expect(canPlace(b, 3, 3, 1, 'h')).toBe(true);
  });

  it('длинный корабль отвергается, если задевает чужой борт хотя бы одной палубой', () => {
    const b = withShip(board(), 0, 0, 1, 'h');
    expect(canPlace(b, 1, 1, 4, 'h')).toBe(false);
    expect(canPlace(b, 2, 0, 4, 'h')).toBe(true);
  });
});

describe('withShip и withoutShipAt', () => {
  it('постановка не трогает исходное поле', () => {
    const before = board();
    const after = withShip(before, 0, 0, 3, 'h');
    expect(before.ships).toHaveLength(0);
    expect(before.shipAt.every((v) => v === -1)).toBe(true);
    expect(after.ships).toHaveLength(1);
  });

  it('shipAt заполняется идентификатором корабля', () => {
    const b = withShip(board(), 2, 3, 3, 'h');
    const ship = b.ships[0];
    for (const c of ship.cells) expect(b.shipAt[c]).toBe(ship.id);
    expect(b.shipAt.filter((v) => v !== -1)).toHaveLength(3);
  });

  it('снятие очищает ровно клетки этого корабля', () => {
    let b = withShip(board(), 0, 0, 2, 'h');
    b = withShip(b, 5, 5, 3, 'h');
    const removed = withoutShipAt(b, 1);
    expect(removed.ships).toHaveLength(1);
    expect(removed.shipAt[0]).toBe(-1);
    expect(removed.shipAt[1]).toBe(-1);
    expect(removed.shipAt[55]).not.toBe(-1);
  });

  it('снять можно за любую палубу, не только за нос', () => {
    const b = withShip(board(), 0, 0, 4, 'h');
    expect(withoutShipAt(b, 3).ships).toHaveLength(0);
  });

  it('снятие с пустой клетки ничего не меняет', () => {
    const b = withShip(board(), 0, 0, 2, 'h');
    expect(withoutShipAt(b, 55)).toBe(b);
  });

  it('битая ссылка в shipAt не роняет снятие', () => {
    const b = withShip(board(), 0, 0, 2, 'h');
    const corrupted = { ...b, ships: [] };
    expect(withoutShipAt(corrupted, 0)).toBe(corrupted);
  });

  it('id не переиспользуются после снятия — иначе shipAt указал бы не на тот корабль', () => {
    let b = withShip(board(), 0, 0, 1, 'h');
    b = withShip(b, 0, 2, 1, 'h');
    b = withShip(b, 0, 4, 1, 'h');
    expect(b.ships.map((s) => s.id)).toEqual([0, 1, 2]);

    b = withoutShipAt(b, idx(0, 2));
    b = withShip(b, 0, 6, 1, 'h');
    expect(b.ships.map((s) => s.id)).toEqual([0, 2, 3]);

    // каждая занятая клетка указывает на существующий корабль
    for (let c = 0; c < b.shipAt.length; c++) {
      if (b.shipAt[c] === -1) continue;
      expect(b.ships.find((s) => s.id === b.shipAt[c])?.cells).toContain(c);
    }
  });
});

describe('legalSpots', () => {
  it('на пустом поле однопалубный встаёт в любую клетку и ровно один раз', () => {
    const spots = legalSpots(board(), 1);
    expect(spots).toHaveLength(100);
    expect(spots.every(([, , o]) => o === 'h')).toBe(true);
  });

  it('для многопалубного считает обе ориентации', () => {
    // 7 стартов в строке × 10 строк, столько же по столбцам
    expect(legalSpots(board(), 4)).toHaveLength(70 + 70);
  });

  it('занятое поле сокращает список', () => {
    const b = withShip(board(), 0, 0, 1, 'h');
    expect(legalSpots(b, 1).length).toBeLessThan(100);
  });
});

/** Полная проверка легальности расстановки по правилам. */
function violations(cells: readonly number[][], shipAt: readonly number[]): string[] {
  const bad: string[] = [];
  const seen = new Set<number>();
  for (const ship of cells) {
    for (const c of ship) {
      if (seen.has(c)) bad.push(`клетка ${c} занята дважды`);
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
          if (!own.has(n) && shipAt[n] !== -1) bad.push(`корабли соприкасаются в ${n}`);
        }
      }
    }
  }
  return bad;
}

describe('randomBoard', () => {
  it('одно зерно — одна и та же расстановка', () => {
    const a = randomBoard(seededRng(777), 'enemy');
    const b = randomBoard(seededRng(777), 'enemy');
    expect(a.shipAt).toEqual(b.shipAt);
    expect(a.ships).toEqual(b.ships);
  });

  it('разные зёрна дают разные расстановки', () => {
    const a = randomBoard(seededRng(1), 'enemy');
    const b = randomBoard(seededRng(2), 'enemy');
    expect(a.shipAt).not.toEqual(b.shipAt);
  });

  it('владелец поля сохраняется', () => {
    expect(randomBoard(seededRng(5), 'player').owner).toBe('player');
    expect(randomBoard(seededRng(5), 'enemy').owner).toBe('enemy');
  });

  it('свойство: 1000 засеянных расстановок легальны', () => {
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
    // тысяча расстановок с полной проверкой — секунды даже на быстрой машине,
    // а на бегунке CI и все пять, поэтому срок задан явно
  }, 30_000);
});

describe('randomBoard без запаса попыток', () => {
  it('падает на запасную расстановку, а не отдаёт пустое поле', () => {
    const b = randomBoard(seededRng(3), 'enemy', 0);
    expect(b.ships).toHaveLength(FLEET_SHIPS);
    expect(b.shipAt).toEqual(canonicalBoard('enemy').shipAt);
  });
});

describe('canonicalBoard — запасная расстановка', () => {
  it('это полный и легальный флот, а не пустое поле', () => {
    const b = canonicalBoard('enemy');
    expect(b.ships).toHaveLength(FLEET_SHIPS);
    expect(b.shipAt.filter((v) => v !== -1)).toHaveLength(TOTAL_DECKS);
    expect(violations(b.ships.map((s) => s.cells), b.shipAt)).toEqual([]);
  });

  it('состав совпадает с уставным', () => {
    const bySize = new Map<number, number>();
    for (const s of canonicalBoard('enemy').ships) bySize.set(s.size, (bySize.get(s.size) ?? 0) + 1);
    for (const spec of FLEET_SPEC) expect(bySize.get(spec.size)).toBe(spec.count);
  });
});

