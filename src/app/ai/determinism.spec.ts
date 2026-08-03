import { describe, expect, it } from 'vitest';
import { Board } from '../domain/board';
import { CELLS } from '../domain/grid';
import { randomBoard } from '../domain/placement';
import { seededRng } from '../domain/rng';
import { afloatSizes, fire, isFleetDestroyed } from '../domain/shot';
import { Difficulty } from './levels';
import { chooseShot } from './opponent';

const LEVELS: Difficulty[] = ['yunga', 'michman', 'admiral'];

interface Played {
  shots: number[];
  results: string[];
  turns: number;
}

/** Играет партию целиком на одном зерне и возвращает всё, что произошло. */
function play(level: Difficulty, layoutSeed: number, aiSeed: number): Played {
  let board: Board = randomBoard(seededRng(layoutSeed), 'player');
  const rng = seededRng(aiSeed);
  const shots: number[] = [];
  const results: string[] = [];

  while (!isFleetDestroyed(board)) {
    const cell = chooseShot(board.shots, afloatSizes(board), level, rng);
    if (cell === -1) throw new Error('стрелять некуда, а флот жив');
    const outcome = fire(board, cell);
    board = outcome.board;
    shots.push(cell);
    results.push(outcome.result);
    if (shots.length > CELLS) throw new Error('партия не сходится');
  }

  return { shots, results, turns: shots.length };
}

describe.each(LEVELS)('детерминизм уровня «%s»', (level) => {
  it('одно зерно — та же последовательность выстрелов', () => {
    const a = play(level, 100, 7);
    const b = play(level, 100, 7);
    expect(b.shots).toEqual(a.shots);
    expect(b.results).toEqual(a.results);
  });

  it('повтор устойчив на десяти разных зёрнах', () => {
    for (let seed = 0; seed < 10; seed++) {
      const a = play(level, seed, seed * 31 + 1);
      const b = play(level, seed, seed * 31 + 1);
      expect(b.shots).toEqual(a.shots);
    }
  });

  it('другое зерно противника — другая партия', () => {
    const a = play(level, 100, 7);
    const b = play(level, 100, 8);
    expect(b.shots).not.toEqual(a.shots);
  });

  it('другая расстановка — другая партия', () => {
    const a = play(level, 100, 7);
    const b = play(level, 101, 7);
    expect(b.shots).not.toEqual(a.shots);
  });

  it('партия всегда сходится и не бьёт дважды в одну клетку', () => {
    for (let seed = 0; seed < 25; seed++) {
      const { shots, turns } = play(level, seed, seed + 500);
      expect(new Set(shots).size).toBe(shots.length);
      expect(turns).toBeLessThanOrEqual(CELLS);
      expect(turns).toBeGreaterThanOrEqual(20); // меньше двадцати палуб не бывает
    }
  });
});

describe('уровни отличаются друг от друга', () => {
  it('на одном зерне три уровня играют по-разному', () => {
    const yunga = play('yunga', 100, 7).shots;
    const michman = play('michman', 100, 7).shots;
    const admiral = play('admiral', 100, 7).shots;
    expect(michman).not.toEqual(yunga);
    expect(admiral).not.toEqual(michman);
    expect(admiral).not.toEqual(yunga);
  });
});
