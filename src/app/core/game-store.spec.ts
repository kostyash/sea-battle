import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Board } from '../domain/board';
import { FLEET_SHIPS, TOTAL_DECKS } from '../domain/fleet';
import { SIZE, idx } from '../domain/grid';
import { canonicalBoard } from '../domain/placement';
import { GAME_SEED, GameStore, PAUSE } from './game-store';

/**
 * The store lives on timers: pauses for the animation stand between salvos.
 * The tests wind the clock themselves, so a game plays out at once and predictably.
 */
const make = (seed = 12345): GameStore => {
  TestBed.configureTestingModule({ providers: [{ provide: GAME_SEED, useValue: seed }] });
  return TestBed.inject(GameStore);
};

/** Winds every pending move forward until the game has settled. */
const settle = (ms = 20000): void => {
  vi.advanceTimersByTime(ms);
};

/**
 * The pause after a hit of your own — exactly as long as the store waits.
 * A magic 1000 used to stand here, picked by eye to sit between 900 and 420: any
 * change to the animations would have broken the tests with “expected over, got battle”.
 */
const afterOwnHit = (): void => {
  vi.advanceTimersByTime(PAUSE.afterHit + PAUSE.beforeFinish);
};

/** Every ship cell of a board — fired at when something has to go down for certain. */
const shipCellsOf = (board: Board): number[] => board.ships.flatMap((s) => s.cells);

describe('GameStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // A language remembered by an earlier test would outlive the module and
    // change the sentences the store renders — the log test reads one of them.
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('the start of a game', () => {
    it('opens in deployment — your own square empty, the opponent’s already drawn', () => {
      const store = make();
      expect(store.phase()).toBe('deploy');
      expect(store.player().ships).toHaveLength(0);
      expect(store.enemy().ships).toHaveLength(FLEET_SHIPS);
      expect(store.winner()).toBeNull();
    });

    it('one seed — one and the same enemy deployment', () => {
      const a = make(777).enemy().shipAt;
      TestBed.resetTestingModule();
      const b = make(777).enemy().shipAt;
      expect(b).toEqual(a);
    });

    it('will not let you into battle without the whole fleet on the chart', () => {
      const store = make();
      store.beginBattle();
      expect(store.phase()).toBe('deploy');
    });
  });

  describe('deployment', () => {
    it('a click stands a ship on the chart and the roster counts one off', () => {
      const store = make();
      store.pickSize(4);
      store.placeAt(idx(0, 0));
      expect(store.player().ships).toHaveLength(1);
      expect(store.roster().find((r) => r.size === 4)?.left).toBe(0);
    });

    it('the next class picks itself once a ship is placed', () => {
      const store = make();
      store.pickSize(4);
      store.placeAt(idx(0, 0));
      expect(store.pickedSize()).toBe(3);
    });

    it('refuses a berth flush against a neighbour — and says why', () => {
      const store = make();
      store.pickSize(4);
      store.placeAt(idx(0, 0));
      store.pickSize(3);
      store.placeAt(idx(1, 0));
      expect(store.player().ships).toHaveLength(1);
      expect(store.message().key).toBe('msg.noRoom');
    });

    it('a click on a standing ship takes it back off and returns it to the roster', () => {
      const store = make();
      store.pickSize(4);
      store.placeAt(idx(0, 0));
      store.placeAt(idx(0, 1));
      expect(store.player().ships).toHaveLength(0);
      expect(store.pickedSize()).toBe(4);
    });

    it('rotating flips the orientation', () => {
      const store = make();
      expect(store.orient()).toBe('h');
      store.rotate();
      expect(store.orient()).toBe('v');
    });

    it('drawing lots deploys the whole fleet', () => {
      const store = make();
      store.autoPlace();
      expect(store.player().ships).toHaveLength(FLEET_SHIPS);
      expect(store.fleetReady()).toBe(true);
    });

    it('clearing sweeps everything off', () => {
      const store = make();
      store.autoPlace();
      store.clearBoard();
      expect(store.player().ships).toHaveLength(0);
      expect(store.fleetReady()).toBe(false);
    });

    it('the silhouette under the cursor shows the picked class at full length', () => {
      const store = make();
      store.pickSize(4);
      store.setHover(idx(5, 0));
      expect(store.ghost()?.cells).toHaveLength(4);
      expect(store.ghost()?.valid).toBe(true);
    });

    it('a silhouette hanging over the edge is marked as not allowed', () => {
      const store = make();
      store.pickSize(4);
      store.setHover(idx(5, 9));
      expect(store.ghost()?.valid).toBe(false);
    });
  });

  describe('the order of moves', () => {
    const ready = (seed = 1): GameStore => {
      const store = make(seed);
      store.autoPlace();
      store.beginBattle();
      return store;
    };

    it('the battle opens on the player’s move', () => {
      const store = ready();
      expect(store.phase()).toBe('battle');
      expect(store.turn()).toBe('player');
      expect(store.canFire()).toBe(true);
    });

    it('a hit buys another salvo: the turn stays with the player', () => {
      const store = ready();
      const target = shipCellsOf(store.enemy())[0];
      store.fireAt(target);
      afterOwnHit();
      expect(store.turn()).toBe('player');
      expect(store.canFire()).toBe(true);
    });

    it('a miss hands the turn over to the opponent', () => {
      const store = ready();
      const miss = store.enemy().shipAt.findIndex((v) => v === -1);
      store.fireAt(miss);
      expect(store.turn()).toBe('enemy');
      expect(store.canFire()).toBe(false);
    });

    it('while the opponent is thinking, there is no firing', () => {
      const store = ready();
      const miss = store.enemy().shipAt.findIndex((v) => v === -1);
      store.fireAt(miss);
      const before = store.enemy().shots.filter((s) => s !== 'unknown').length;
      store.fireAt(shipCellsOf(store.enemy())[0]);
      expect(store.enemy().shots.filter((s) => s !== 'unknown').length).toBe(before);
    });

    it('once the opponent has missed, the turn comes back', () => {
      const store = ready();
      const miss = store.enemy().shipAt.findIndex((v) => v === -1);
      store.fireAt(miss);
      settle();
      expect(store.turn()).toBe('player');
      expect(store.busy()).toBe(false);
    });

    it('the same square cannot be fired at twice', () => {
      const store = ready();
      const target = shipCellsOf(store.enemy())[0];
      store.fireAt(target);
      afterOwnHit();
      const shots = store.playerStats().shots;
      store.fireAt(target);
      expect(store.playerStats().shots).toBe(shots);
    });
  });

  describe('victory', () => {
    it('shooting the whole enemy fleet to pieces ends the game in victory', () => {
      const store = make(3);
      store.autoPlace();
      store.beginBattle();

      for (const cell of shipCellsOf(store.enemy())) {
        store.fireAt(cell);
        afterOwnHit();
      }
      settle();

      expect(store.phase()).toBe('over');
      expect(store.winner()).toBe('player');
      expect(store.enemyLosses()).toBe(FLEET_SHIPS);
      expect(store.enemyDecksLeft()).toBe(0);
      expect(store.message().key).toBe('msg.won');
    });

    it('the result card comes not at once, but after the square has been surveyed', () => {
      const store = make(3);
      store.autoPlace();
      store.beginBattle();
      for (const cell of shipCellsOf(store.enemy())) {
        store.fireAt(cell);
        afterOwnHit();
      }
      expect(store.phase()).toBe('over');
      expect(store.verdictOpen()).toBe(false);
      settle();
      expect(store.verdictOpen()).toBe(true);
    });

    it('a card put away by hand does not float back up on the timer', () => {
      const store = make(3);
      store.autoPlace();
      store.beginBattle();
      for (const cell of shipCellsOf(store.enemy())) {
        store.fireAt(cell);
        afterOwnHit();
      }
      store.closeVerdict();
      settle();
      expect(store.verdictOpen()).toBe(false);
    });

    it('once the game is won, shots no longer go through', () => {
      const store = make(3);
      store.autoPlace();
      store.beginBattle();
      for (const cell of shipCellsOf(store.enemy())) {
        store.fireAt(cell);
        afterOwnHit();
      }
      settle();
      const shots = store.playerStats().shots;
      const free = store.enemy().shots.findIndex((s) => s === 'unknown');
      if (free !== -1) store.fireAt(free);
      expect(store.playerStats().shots).toBe(shots);
    });
  });

  describe('defeat', () => {
    it('the opponent that finishes off the player’s fleet wins the game', () => {
      const store = make(5);
      store.autoPlace();
      store.beginBattle();

      // The player does nothing but miss; the opponent quietly plays its own game out.
      for (let n = 0; n < 400 && store.phase() === 'battle'; n++) {
        if (store.canFire()) {
          const miss = store
            .enemy()
            .shots.findIndex((s, i) => s === 'unknown' && store.enemy().shipAt[i] === -1);
          if (miss === -1) break;
          store.fireAt(miss);
        }
        settle(3000);
      }

      expect(store.phase()).toBe('over');
      expect(store.winner()).toBe('enemy');
      expect(store.playerDecksLeft()).toBe(0);
      expect(store.message().key).toBe('msg.lost');
    });
  });

  describe('statistics and the firing log', () => {
    it('counts salvos, hits and accuracy', () => {
      const store = make(7);
      store.autoPlace();
      store.beginBattle();

      const hit = shipCellsOf(store.enemy())[0];
      store.fireAt(hit);
      afterOwnHit();
      expect(store.playerStats()).toMatchObject({ shots: 1, hits: 1, accuracy: 100 });

      const miss = store
        .enemy()
        .shots.findIndex((s, i) => s === 'unknown' && store.enemy().shipAt[i] === -1);
      store.fireAt(miss);
      expect(store.playerStats()).toMatchObject({ shots: 2, hits: 1, accuracy: 50 });
    });

    it('with no salvos fired accuracy is zero, not a division by zero', () => {
      const store = make();
      expect(store.playerStats().accuracy).toBe(0);
    });

    it('the log writes down the square and the outcome, the newest on top', () => {
      const store = make(7);
      store.autoPlace();
      store.beginBattle();
      const hit = shipCellsOf(store.enemy())[0];
      store.fireAt(hit);
      afterOwnHit();

      const top = store.log()[0];
      expect(top.side).toBe('player');
      expect(top.cell).toBe(hit);
      expect(['hit', 'sunk']).toContain(top.result);
    });

    it('a sunk ship goes into the log as a length, so the line can be re-read in another language', () => {
      const store = make(7);
      store.autoPlace();
      store.beginBattle();

      const boat = store.enemy().ships.find((s) => s.size === 1)!;
      store.fireAt(boat.cells[0]);
      afterOwnHit();

      const top = store.log()[0];
      expect(top.result).toBe('sunk');
      expect(top.shipSize).toBe(1);
      expect(store.messageText()).toContain('patrol boat');
    });

    it('the log does not grow without end', () => {
      const store = make(9);
      store.autoPlace();
      store.beginBattle();
      for (let n = 0; n < 400 && store.phase() === 'battle'; n++) {
        if (store.canFire()) {
          const free = store.enemy().shots.findIndex((s) => s === 'unknown');
          if (free === -1) break;
          store.fireAt(free);
        }
        settle(3000);
      }
      expect(store.log().length).toBeLessThanOrEqual(60);
    });
  });

  describe('a new game', () => {
    it('resets the board, the score and the log', () => {
      const store = make(11);
      store.autoPlace();
      store.beginBattle();
      store.fireAt(shipCellsOf(store.enemy())[0]);
      afterOwnHit();

      store.newGame();

      expect(store.phase()).toBe('deploy');
      expect(store.player().ships).toHaveLength(0);
      expect(store.log()).toEqual([]);
      expect(store.playerStats().shots).toBe(0);
      expect(store.winner()).toBeNull();
      expect(store.turn()).toBe('player');
    });

    it('a rematch stands the fleet up straight away and waits for the order to fight', () => {
      const store = make(11);
      store.rematch();
      expect(store.phase()).toBe('deploy');
      expect(store.fleetReady()).toBe(true);
    });

    it('the pending moves of the game before do not touch the new one', () => {
      const store = make(13);
      store.autoPlace();
      store.beginBattle();
      const miss = store.enemy().shipAt.findIndex((v) => v === -1);
      store.fireAt(miss); // the opponent has the turn and is thinking

      store.newGame();
      const clean = store.player().shots.filter((s) => s !== 'unknown').length;
      settle();

      expect(store.player().shots.filter((s) => s !== 'unknown').length).toBe(clean);
      expect(store.phase()).toBe('deploy');
    });
  });

  describe('the opponent’s level', () => {
    it('changes before the battle', () => {
      const store = make();
      store.setDifficulty('admiral');
      expect(store.difficulty()).toBe('admiral');
    });

    it('does not change in the thick of the battle', () => {
      const store = make();
      store.autoPlace();
      store.beginBattle();
      store.setDifficulty('admiral');
      expect(store.difficulty()).toBe('midshipman');
    });
  });

  describe('the integrity of the board', () => {
    it('the player has exactly twenty decks after drawing lots', () => {
      const store = make(17);
      store.autoPlace();
      expect(store.player().shipAt.filter((v) => v !== -1)).toHaveLength(TOTAL_DECKS);
      expect(store.playerDecksLeft()).toBe(TOTAL_DECKS);
    });

    it('deploying by hand gives the same square as the prepared board', () => {
      const store = make();
      const canon = canonicalBoard('player');
      for (const ship of canon.ships) {
        store.pickSize(ship.size);
        store.placeAt(ship.row * SIZE + ship.col);
      }
      expect(store.fleetReady()).toBe(true);
      expect(store.player().shipAt).toEqual(canon.shipAt);
    });
  });
});
