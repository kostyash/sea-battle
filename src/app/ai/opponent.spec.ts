import { describe, expect, it } from 'vitest';
import { CellState } from '../domain/board';
import { CELLS, colOf, idx, rowOf } from '../domain/grid';
import { Rng, seededRng } from '../domain/rng';
import { DIFFICULTIES, Difficulty, difficultyName } from './levels';
import { chooseShot } from './opponent';

const LEVELS: Difficulty[] = ['yunga', 'michman', 'admiral'];
const FULL_FLEET = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];

const blank = (): CellState[] => new Array<CellState>(CELLS).fill('unknown');

const withMarks = (marks: Record<number, CellState>): CellState[] => {
  const shots = blank();
  for (const [cell, state] of Object.entries(marks)) shots[Number(cell)] = state;
  return shots;
};

/** Генератор, всегда выдающий одно и то же — чтобы читать выбор, а не жребий. */
const fixedRng = (value: number): Rng => ({
  next: () => value,
  int: (bound) => (bound <= 0 ? 0 : Math.floor(value * bound)),
  pick: (items) => items[Math.floor(value * items.length)],
});

describe('уровни', () => {
  it('их ровно три и у каждого есть имя и подсказка', () => {
    expect(DIFFICULTIES).toHaveLength(3);
    expect(DIFFICULTIES.map((d) => d.id)).toEqual(LEVELS);
    for (const d of DIFFICULTIES) {
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.hint.length).toBeGreaterThan(0);
    }
  });

  it('difficultyName называет каждый уровень', () => {
    expect(difficultyName('yunga')).toBe('Юнга');
    expect(difficultyName('michman')).toBe('Мичман');
    expect(difficultyName('admiral')).toBe('Адмирал');
  });

  it('на неизвестный уровень отвечает общим словом', () => {
    expect(difficultyName('нет такого' as Difficulty)).toBe('Противник');
  });
});

describe.each(LEVELS)('общие требования к уровню «%s»', (level) => {
  it('бьёт только по непристрелянным клеткам', () => {
    const rng = seededRng(11);
    const shots = blank();
    for (let n = 0; n < CELLS; n++) {
      const cell = chooseShot(shots, FULL_FLEET, level, rng);
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(shots[cell]).toBe('unknown');
      shots[cell] = 'miss';
    }
  });

  it('на добитом поле честно отвечает -1', () => {
    const shots = new Array<CellState>(CELLS).fill('miss');
    expect(chooseShot(shots, [], level, seededRng(1))).toBe(-1);
  });

  it('не падает, когда на плаву не осталось калибров', () => {
    const cell = chooseShot(blank(), [], level, seededRng(3));
    expect(cell).toBeGreaterThanOrEqual(0);
  });

  it('одно зерно — одна и та же клетка', () => {
    const shots = withMarks({ [idx(4, 4)]: 'hit' });
    const a = chooseShot(shots, FULL_FLEET, level, seededRng(99));
    const b = chooseShot(shots, FULL_FLEET, level, seededRng(99));
    expect(a).toBe(b);
  });
});

describe('Юнга', () => {
  it('при жребии ниже порога добивает соседнюю клетку', () => {
    const shots = withMarks({ [idx(5, 5)]: 'hit' });
    const cell = chooseShot(shots, FULL_FLEET, 'yunga', fixedRng(0));
    expect([idx(4, 5), idx(6, 5), idx(5, 4), idx(5, 6)]).toContain(cell);
  });

  it('при жребии выше порога бьёт куда попало, а не добивает', () => {
    const shots = withMarks({ [idx(5, 5)]: 'hit' });
    const cell = chooseShot(shots, FULL_FLEET, 'yunga', fixedRng(0.9));
    expect([idx(4, 5), idx(6, 5), idx(5, 4), idx(5, 6)]).not.toContain(cell);
  });

  it('если все соседи раны уже пристреляны — бьёт в другое место', () => {
    const shots = withMarks({
      [idx(5, 5)]: 'hit',
      [idx(4, 5)]: 'miss',
      [idx(6, 5)]: 'miss',
      [idx(5, 4)]: 'miss',
      [idx(5, 6)]: 'miss',
    });
    const cell = chooseShot(shots, FULL_FLEET, 'yunga', fixedRng(0));
    expect(shots[cell]).toBe('unknown');
  });
});

describe('Мичман', () => {
  it('без ран ищет по чёрным клеткам, пока жив многопалубный', () => {
    const rng = seededRng(5);
    for (let n = 0; n < 40; n++) {
      const cell = chooseShot(blank(), FULL_FLEET, 'michman', rng);
      expect((rowOf(cell) + colOf(cell)) % 2).toBe(0);
    }
  });

  it('когда остались только катера, шаг через клетку снимается', () => {
    const rng = seededRng(5);
    const parities = new Set<number>();
    for (let n = 0; n < 200; n++) {
      const cell = chooseShot(blank(), [1, 1, 1], 'michman', rng);
      parities.add((rowOf(cell) + colOf(cell)) % 2);
    }
    expect(parities).toEqual(new Set([0, 1]));
  });

  it('одну рану добивает по соседям', () => {
    const shots = withMarks({ [idx(5, 5)]: 'hit' });
    const cell = chooseShot(shots, FULL_FLEET, 'michman', seededRng(2));
    expect([idx(4, 5), idx(6, 5), idx(5, 4), idx(5, 6)]).toContain(cell);
  });

  it('нащупав линию, продолжает её с конца, а не бьёт вбок', () => {
    const shots = withMarks({ [idx(5, 4)]: 'hit', [idx(5, 5)]: 'hit' });
    for (const seed of [1, 2, 3, 4, 5]) {
      const cell = chooseShot(shots, FULL_FLEET, 'michman', seededRng(seed));
      expect([idx(5, 3), idx(5, 6)]).toContain(cell);
    }
  });

  it('продолжает и вертикальную линию', () => {
    const shots = withMarks({ [idx(4, 5)]: 'hit', [idx(5, 5)]: 'hit' });
    for (const seed of [1, 2, 3]) {
      const cell = chooseShot(shots, FULL_FLEET, 'michman', seededRng(seed));
      expect([idx(3, 5), idx(6, 5)]).toContain(cell);
    }
  });

  it('упершись в закрытый конец, бьёт в открытый', () => {
    const shots = withMarks({
      [idx(5, 4)]: 'hit',
      [idx(5, 5)]: 'hit',
      [idx(5, 3)]: 'miss',
    });
    for (const seed of [1, 2, 3, 4]) {
      expect(chooseShot(shots, FULL_FLEET, 'michman', seededRng(seed))).toBe(idx(5, 6));
    }
  });

  it('линия у края поля продолжается только внутрь', () => {
    const shots = withMarks({ [idx(0, 0)]: 'hit', [idx(0, 1)]: 'hit' });
    for (const seed of [1, 2, 3]) {
      expect(chooseShot(shots, FULL_FLEET, 'michman', seededRng(seed))).toBe(idx(0, 2));
    }
  });

  it('если оба конца линии закрыты, добивает соседей другой раны', () => {
    const shots = withMarks({
      [idx(5, 4)]: 'hit',
      [idx(5, 5)]: 'hit',
      [idx(5, 3)]: 'miss',
      [idx(5, 6)]: 'miss',
    });
    const cell = chooseShot(shots, FULL_FLEET, 'michman', seededRng(7));
    expect([idx(4, 4), idx(6, 4), idx(4, 5), idx(6, 5)]).toContain(cell);
  });
});
