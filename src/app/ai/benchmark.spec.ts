import { describe, expect, it } from 'vitest';
import { FLEET_SHIPS, TOTAL_DECKS } from '../domain/fleet';
import { CELLS } from '../domain/grid';
import { randomBoard } from '../domain/placement';
import { seededRng } from '../domain/rng';
import { salvosToClear } from './benchmark';

describe('how long the opponent would have taken', () => {
  it('clears a whole fleet, and cannot do it in fewer salvos than there are decks', () => {
    const board = randomBoard(seededRng(2024), 'enemy');
    const salvos = salvosToClear(board.ships, seededRng(7));

    expect(board.ships).toHaveLength(FLEET_SHIPS);
    // every deck has to be hit at least once, and the board is only so big
    expect(salvos).toBeGreaterThanOrEqual(TOTAL_DECKS);
    expect(salvos).toBeLessThan(CELLS);
  });

  it('one seed — one and the same number', () => {
    const ships = randomBoard(seededRng(99), 'enemy').ships;

    expect(salvosToClear(ships, seededRng(5))).toBe(salvosToClear(ships, seededRng(5)));
  });

  /**
   * Over varied deployments, not one — a single layout can happen to suit a
   * blind shooter, and on twelve seeds of the canonical board the Cabin Boy
   * actually came out ahead. The number on the result card is only worth
   * printing if it tracks skill across boards.
   */
  it('a weaker level takes longer at it — the number means something', () => {
    const admiral: number[] = [];
    const cabinBoy: number[] = [];

    for (let seed = 1; seed <= 25; seed++) {
      const ships = randomBoard(seededRng(seed * 131), 'enemy').ships;
      admiral.push(salvosToClear(ships, seededRng(seed), 'admiral'));
      cabinBoy.push(salvosToClear(ships, seededRng(seed), 'cabin-boy'));
    }
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

    expect(mean(admiral)).toBeLessThan(mean(cabinBoy));
  });

  it('leaves the fleet it was handed exactly as it found it', () => {
    const board = randomBoard(seededRng(31), 'enemy');
    const before = board.ships.map((s) => ({ ...s, cells: [...s.cells] }));

    salvosToClear(board.ships, seededRng(3));

    // the replay builds its own board — nothing of the real game may move
    expect(board.ships).toEqual(before);
    expect(board.shots.every((state) => state === 'unknown')).toBe(true);
  });
});
