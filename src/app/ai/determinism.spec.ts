import { describe, expect, it } from 'vitest';
import { Board } from '../domain/board';
import { CELLS } from '../domain/grid';
import { randomBoard } from '../domain/placement';
import { seededRng } from '../domain/rng';
import { afloatSizes, fire, isFleetDestroyed } from '../domain/shot';
import { Difficulty } from './levels';
import { chooseShot } from './opponent';

const LEVELS: Difficulty[] = ['cabin-boy', 'midshipman', 'admiral'];

interface Played {
  shots: number[];
  results: string[];
  turns: number;
}

/** Plays a whole game on a single seed and returns everything that happened. */
function play(level: Difficulty, layoutSeed: number, aiSeed: number): Played {
  let board: Board = randomBoard(seededRng(layoutSeed), 'player');
  const rng = seededRng(aiSeed);
  const shots: number[] = [];
  const results: string[] = [];

  while (!isFleetDestroyed(board)) {
    const cell = chooseShot(board.shots, afloatSizes(board), level, rng);
    if (cell === -1) throw new Error('nowhere left to shoot, yet the fleet is alive');
    const outcome = fire(board, cell);
    board = outcome.board;
    shots.push(cell);
    results.push(outcome.result);
    if (shots.length > CELLS) throw new Error('the game never ends');
  }

  return { shots, results, turns: shots.length };
}

describe.each(LEVELS)('determinism of the "%s" level', (level) => {
  it('one seed — the same sequence of shots', () => {
    const a = play(level, 100, 7);
    const b = play(level, 100, 7);
    expect(b.shots).toEqual(a.shots);
    expect(b.results).toEqual(a.results);
  });

  it('the replay holds up across ten different seeds', () => {
    for (let seed = 0; seed < 10; seed++) {
      const a = play(level, seed, seed * 31 + 1);
      const b = play(level, seed, seed * 31 + 1);
      expect(b.shots).toEqual(a.shots);
    }
  });

  it('a different opponent seed — a different game', () => {
    const a = play(level, 100, 7);
    const b = play(level, 100, 8);
    expect(b.shots).not.toEqual(a.shots);
  });

  it('a different deployment — a different game', () => {
    const a = play(level, 100, 7);
    const b = play(level, 101, 7);
    expect(b.shots).not.toEqual(a.shots);
  });

  it('the game always ends and never fires twice at the same cell', () => {
    for (let seed = 0; seed < 25; seed++) {
      const { shots, turns } = play(level, seed, seed + 500);
      expect(new Set(shots).size).toBe(shots.length);
      expect(turns).toBeLessThanOrEqual(CELLS);
      expect(turns).toBeGreaterThanOrEqual(20); // there are never fewer than twenty decks
    }
  });
});

describe('the levels differ from one another', () => {
  it('on one and the same seed the three levels play differently', () => {
    const cabinBoy = play('cabin-boy', 100, 7).shots;
    const midshipman = play('midshipman', 100, 7).shots;
    const admiral = play('admiral', 100, 7).shots;
    expect(midshipman).not.toEqual(cabinBoy);
    expect(admiral).not.toEqual(midshipman);
    expect(admiral).not.toEqual(cabinBoy);
  });
});
