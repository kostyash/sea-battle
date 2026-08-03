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

describe('карта плотности', () => {
  it('на пустом поле середина ценнее угла — там больше расстановок', () => {
    const { score } = densityMap(blank(), FULL_FLEET);
    expect(score[idx(4, 4)]).toBeGreaterThan(score[idx(0, 0)]);
    expect(score[idx(4, 4)]).toBeGreaterThan(score[idx(0, 5)]);
  });

  it('на пустом поле карта симметрична', () => {
    const { score } = densityMap(blank(), FULL_FLEET);
    expect(score[idx(0, 0)]).toBe(score[idx(9, 9)]);
    expect(score[idx(0, 3)]).toBe(score[idx(9, 6)]);
    expect(score[idx(2, 7)]).toBe(score[idx(7, 2)]);
  });

  it('промах обнуляет свою клетку и роняет соседние', () => {
    const clean = densityMap(blank(), FULL_FLEET).score;
    const { score } = densityMap(withMarks({ [idx(4, 4)]: 'miss' }), FULL_FLEET);
    expect(score[idx(4, 4)]).toBe(0);
    expect(score[idx(4, 5)]).toBeLessThan(clean[idx(4, 5)]);
  });

  it('потопленная клетка тоже перекрывает расстановки', () => {
    const { score } = densityMap(withMarks({ [idx(4, 4)]: 'sunk' }), FULL_FLEET);
    expect(score[idx(4, 4)]).toBe(0);
  });

  it('без ран режим добивания не включается', () => {
    expect(densityMap(blank(), FULL_FLEET).mustFinish).toBe(false);
  });

  it('одна рана переводит карту в режим добивания', () => {
    const { mustFinish, score } = densityMap(withMarks({ [idx(4, 4)]: 'hit' }), FULL_FLEET);
    expect(mustFinish).toBe(true);
    // вес получают только клетки, продолжающие раненый корабль
    expect(score[idx(4, 5)]).toBeGreaterThan(0);
    expect(score[idx(0, 0)]).toBe(0);
  });

  it('раненая линия ценит свои концы выше, чем бока', () => {
    const shots = withMarks({ [idx(5, 4)]: 'hit', [idx(5, 5)]: 'hit' });
    const { score } = densityMap(shots, FULL_FLEET);
    expect(score[idx(5, 3)]).toBeGreaterThan(0);
    expect(score[idx(5, 6)]).toBeGreaterThan(0);
    // вбок корабль уйти не может — он бы соприкоснулся сам с собой
    expect(score[idx(4, 4)]).toBe(0);
    expect(score[idx(6, 5)]).toBe(0);
  });

  it('в щель, куда калибр не влезает, он веса не приносит', () => {
    // Щель шириной 3 по горизонтали: столбцы 5..7, отгороженные промахами.
    // По вертикали её тоже надо закрыть, иначе четырёхпалубный встанет поперёк.
    const walls: Record<number, CellState> = {};
    for (let r = 0; r < 10; r++) {
      walls[idx(r, 4)] = 'miss';
      walls[idx(r, 8)] = 'miss';
    }
    for (let c = 5; c <= 7; c++) {
      walls[idx(1, c)] = 'miss';
    }
    const shots = withMarks(walls);
    const gap = idx(0, 6); // середина щели 3x1 в верхнем ряду

    // трёхпалубный сюда встаёт, четырёхпалубному места нет ни вдоль, ни поперёк
    expect(densityMap(shots, [3]).score[gap]).toBeGreaterThan(0);
    expect(densityMap(shots, [4]).score[gap]).toBe(0);
  });

  it('чем больше однотипных калибров на плаву, тем выше вес клетки', () => {
    const one = densityMap(blank(), [3]).score[idx(4, 4)];
    const two = densityMap(blank(), [3, 3]).score[idx(4, 4)];
    expect(two).toBe(one * 2);
  });

  it('пустой список калибров даёт нулевую карту', () => {
    expect(densityMap(blank(), []).score.every((v) => v === 0)).toBe(true);
  });
});

describe('touchesForeignHit', () => {
  it('видит чужую рану сбоку', () => {
    const shots = withMarks({ [idx(5, 5)]: 'hit' });
    expect(touchesForeignHit(shots, [idx(5, 6)])).toBe(true);
  });

  it('видит чужую рану по диагонали — корабли не касаются углами', () => {
    const shots = withMarks({ [idx(5, 5)]: 'hit' });
    expect(touchesForeignHit(shots, [idx(6, 6)])).toBe(true);
  });

  it('свою рану внутри корпуса чужой не считает', () => {
    const shots = withMarks({ [idx(5, 5)]: 'hit' });
    expect(touchesForeignHit(shots, [idx(5, 5), idx(5, 6)])).toBe(false);
  });

  it('через клетку — уже не касание', () => {
    const shots = withMarks({ [idx(5, 5)]: 'hit' });
    expect(touchesForeignHit(shots, [idx(5, 7)])).toBe(false);
  });

  it('у края поля не выходит за границы', () => {
    const shots = withMarks({ [idx(0, 0)]: 'hit' });
    expect(touchesForeignHit(shots, [idx(0, 2)])).toBe(false);
    expect(touchesForeignHit(shots, [idx(1, 1)])).toBe(true);
  });
});

describe('выбор выстрела по плотности', () => {
  it('бьёт в клетку с наибольшим весом', () => {
    const shots = blank();
    const { score } = densityMap(shots, FULL_FLEET);
    const best = Math.max(...score);
    const cell = densityShot(shots, FULL_FLEET, openCells(shots), seededRng(1));
    expect(score[cell]).toBe(best);
  });

  it('раненый корабль добивается, а не бросается', () => {
    const shots = withMarks({ [idx(5, 5)]: 'hit' });
    for (const seed of [1, 2, 3, 4, 5]) {
      const cell = densityShot(shots, FULL_FLEET, openCells(shots), seededRng(seed));
      expect([idx(4, 5), idx(6, 5), idx(5, 4), idx(5, 6)]).toContain(cell);
    }
  });

  it('когда ни одна расстановка не сходится, честно отдаёт -1', () => {
    // рана есть, но вокруг всё закрыто: продолжить корабль некуда
    const shots = withMarks({
      [idx(5, 5)]: 'hit',
      [idx(4, 5)]: 'miss',
      [idx(6, 5)]: 'miss',
      [idx(5, 4)]: 'miss',
      [idx(5, 6)]: 'miss',
    });
    expect(densityShot(shots, FULL_FLEET, openCells(shots), seededRng(1))).toBe(-1);
  });

  it('в этом тупике Адмирал не встаёт, а падает в мичманский поиск', () => {
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

  it('первый ход делается по чёрным клеткам — так ложится плотность', () => {
    const cell = chooseShot(blank(), FULL_FLEET, 'admiral', seededRng(1));
    expect((rowOf(cell) + colOf(cell)) % 2).toBe(0);
  });

  it('никогда не выбирает уже пристрелянную клетку', () => {
    const rng = seededRng(31);
    const shots = blank();
    for (let n = 0; n < 60; n++) {
      const cell = chooseShot(shots, FULL_FLEET, 'admiral', rng);
      expect(shots[cell]).toBe('unknown');
      shots[cell] = 'miss';
    }
  });
});
