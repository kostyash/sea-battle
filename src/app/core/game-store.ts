import { InjectionToken, Injectable, computed, inject, signal } from '@angular/core';
import { salvosToClear } from '../ai/benchmark';
import { hiddenBoard } from '../ai/berthing';
import { densityMap } from '../ai/density';
import { chooseShot } from '../ai/opponent';
import { Difficulty } from '../ai/levels';
import { AudioService } from './audio';
import { Board, CellState, ShotResult, emptyBoard } from '../domain/board';
import { FLEET_SHIPS, FLEET_SPEC, isSunk } from '../domain/fleet';
import { Orientation, SIZE, Side } from '../domain/grid';
import {
  canPlace,
  clippedCells,
  randomBoard,
  shipCells,
  withShip,
  withoutShipAt,
} from '../domain/placement';
import { entropySeed, seededRng } from '../domain/rng';
import { afloatSizes, fire, isFleetDestroyed } from '../domain/shot';
import { I18n } from '../i18n/i18n';
import { MsgKey } from '../i18n/en';
import { Msg } from '../i18n/phrase';

export type Phase = 'deploy' | 'battle' | 'over';

/**
 * The pauses between moves. Not decoration: they are when the splash plays, the
 * silhouette of a sunk ship settles and the status line gets read. Pulled out so
 * that tests can wind the clock by name rather than by magic numbers picked by eye.
 */
export const PAUSE = {
  /** A hit: the pause before firing is allowed again. */
  afterHit: 420,
  /** The player missed: how long the opponent "thinks" before its salvo. */
  enemyThinks: 950,
  /** The opponent missed: the pause before the turn comes back to the player. */
  turnBack: 600,
  /** The opponent hit: the pause before its next salvo. */
  enemyVolley: 1050,
  /** The last salvo: the pause before the result is announced. */
  beforeFinish: 900,
  /** Surveying the square before the result card is shown. */
  beforeVerdict: 1500,
} as const;

/**
 * The seed of a game. Taken from entropy when playing, substituted in tests —
 * and then both the opponent's deployment and its shots repeat exactly.
 */
export const GAME_SEED = new InjectionToken<number>('game seed', {
  providedIn: 'root',
  factory: entropySeed,
});

/**
 * A line of the firing log, kept as data rather than as a sentence: the cell is
 * a number and a sunk ship is a length, so the log re-reads itself in the new
 * language when the player switches mid-game.
 */
export interface LogEntry {
  id: number;
  side: Side;
  cell: number;
  result: ShotResult;
  shipSize: number | null;
}

/**
 * One salvo of the opponent's, kept whole: the marks as they stood, what it
 * reckoned of every square, and where it fired.
 *
 * The Admiral already works this out before each salvo and then throws it away.
 * Keeping it costs a hundred numbers a turn and buys the one thing the player
 * never gets to see — the reasoning that hunted them down.
 */
export interface Reckoning {
  shots: readonly CellState[];
  score: readonly number[];
  cell: number;
  result: ShotResult;
}

export interface Splash {
  id: number;
  side: Side;
  cell: number;
  result: ShotResult;
}

interface Tally {
  shots: number;
  hits: number;
}

@Injectable({ providedIn: 'root' })
export class GameStore {
  readonly audio = inject(AudioService);
  private readonly i18n = inject(I18n);

  private readonly seed = inject(GAME_SEED);

  /** The one source of randomness in a game — see `GAME_SEED`. */
  private rng = seededRng(this.seed);

  /* ── the state of a game ────────────────────────────────────────────── */

  readonly phase = signal<Phase>('deploy');
  readonly difficulty = signal<Difficulty>('midshipman');
  readonly player = signal<Board>(emptyBoard('player'));
  readonly enemy = signal<Board>(hiddenBoard(this.rng, 'enemy'));
  readonly turn = signal<Side>('player');
  /** A move is under way: a shot animating, or the opponent thinking. */
  readonly busy = signal(false);
  readonly winner = signal<Side | null>(null);
  /** The result card waits for the square to be charted, and can be dismissed. */
  readonly verdictOpen = signal(false);
  readonly log = signal<LogEntry[]>([]);
  readonly splash = signal<Splash | null>(null);

  /** The opponent's reckoning, salvo by salvo. Only the Admiral keeps one. */
  readonly reckoning = signal<Reckoning[]>([]);
  /** Which salvo of that reckoning is being looked at. */
  readonly replayAt = signal(0);
  readonly replayOpen = signal(false);

  /** The reckoning now on show, if the replay is open. */
  readonly replayFrame = computed(() => {
    if (!this.replayOpen()) return null;
    const frames = this.reckoning();
    return frames[Math.min(this.replayAt(), frames.length - 1)] ?? null;
  });

  /** The status line, still as a key and its data — see `messageText`. */
  readonly message = signal<Msg<MsgKey>>({ key: 'msg.deploy' });
  readonly messageText = computed(() => this.i18n.say(this.message()));

  private readonly playerTally = signal<Tally>({ shots: 0, hits: 0 });
  private readonly enemyTally = signal<Tally>({ shots: 0, hits: 0 });

  /* ── deployment ─────────────────────────────────────────────────────── */

  readonly pickedSize = signal<number | null>(4);
  readonly orient = signal<Orientation>('h');
  readonly hover = signal<number | null>(null);

  readonly roster = computed(() => {
    const placed = this.player().ships;
    return FLEET_SPEC.map((spec) => ({
      ...spec,
      left: spec.count - placed.filter((s) => s.size === spec.size).length,
    }));
  });

  readonly fleetReady = computed(() => this.player().ships.length === FLEET_SHIPS);

  /** The silhouette under the cursor while deploying: where it lands, and whether it may. */
  readonly ghost = computed(() => {
    if (this.phase() !== 'deploy') return null;
    const cell = this.hover();
    const size = this.pickedSize();
    if (cell === null || size === null) return null;
    const row = Math.floor(cell / 10);
    const col = cell % 10;
    const orient = this.orient();
    const valid = canPlace(this.player(), row, col, size, orient);
    const full = shipCells(row, col, size, orient);
    return { cells: full.length ? full : clippedCells(row, col, size, orient), valid, size, orient };
  });

  /* ── the battle summary ─────────────────────────────────────────────── */

  readonly playerStats = computed(() => summarise(this.playerTally()));
  readonly enemyStats = computed(() => summarise(this.enemyTally()));
  readonly enemyLosses = computed(() => this.enemy().ships.filter(isSunk).length);
  readonly playerLosses = computed(() => this.player().ships.filter(isSunk).length);
  readonly enemyDecksLeft = computed(() =>
    this.enemy().ships.reduce((n, s) => n + (s.size - s.hits), 0),
  );
  readonly playerDecksLeft = computed(() =>
    this.player().ships.reduce((n, s) => n + (s.size - s.hits), 0),
  );

  /**
   * What the Admiral would have needed against the very fleet you just cleared.
   *
   * Sixty-one salvos means nothing on its own; sixty-one against his fifty-four
   * means something. Worked out only once the battle is won — after a defeat the
   * square was never cleared and there is nothing to hold the number against —
   * and off a seed of its own, so asking the question cannot disturb the game's
   * own randomness.
   */
  readonly admiralSalvos = computed(() => {
    if (this.phase() !== 'over' || this.winner() !== 'player') return 0;
    return salvosToClear(this.enemy().ships, seededRng(this.seed ^ 0x9e3779b9));
  });

  readonly canFire = computed(
    () => this.phase() === 'battle' && this.turn() === 'player' && !this.busy(),
  );

  /** Grows with every new battle — kills the timers of the previous game. */
  private era = 0;
  /** The result was already dismissed by hand — it must not pop back up on a timer. */
  private verdictDismissed = false;
  private logSeq = 0;
  private splashSeq = 0;

  /* ── deployment: actions ────────────────────────────────────────────── */

  pickSize(size: number): void {
    this.pickedSize.set(size);
    this.audio.rotate();
  }

  rotate(): void {
    this.orient.update((o) => (o === 'h' ? 'v' : 'h'));
    this.audio.rotate();
  }

  setHover(cell: number | null): void {
    if (this.phase() === 'deploy') this.hover.set(cell);
  }

  /**
   * Turn whatever is under the pointer: a ship already standing on the chart, or
   * else the one waiting to be placed. One gesture, and it means the same thing
   * in both cases — which is the point, since a ship you have just put down is
   * exactly when you discover you wanted it the other way round.
   *
   * It pivots on the bow, and is pulled back onto the board if turning would
   * take the stern over the edge. If it still will not fit — a neighbour is too
   * close — nothing moves and the rail says so, rather than the ship silently
   * refusing.
   */
  rotateAt(cell: number): void {
    if (this.phase() !== 'deploy') return;
    const board = this.player();
    const id = cell < 0 ? -1 : board.shipAt[cell];
    if (id === -1) {
      this.rotate();
      return;
    }

    const ship = board.ships.find((s) => s.id === id)!;
    const turned = ship.orient === 'h' ? 'v' : 'h';
    const row = turned === 'v' ? Math.min(ship.row, SIZE - ship.size) : ship.row;
    const col = turned === 'h' ? Math.min(ship.col, SIZE - ship.size) : ship.col;

    const bare = withoutShipAt(board, cell);
    if (!canPlace(bare, row, col, ship.size, turned)) {
      this.message.set({ key: 'msg.noTurn' });
      return;
    }

    this.player.set(withShip(bare, row, col, ship.size, turned));
    this.audio.rotate();
    this.message.set({ key: 'msg.turned', params: { size: ship.size } });
  }

  /** A click on your own chart: place the picked ship, or take back one already standing. */
  placeAt(cell: number): void {
    if (this.phase() !== 'deploy') return;
    const board = this.player();

    if (board.shipAt[cell] !== -1) {
      const removed = board.ships.find((s) => s.id === board.shipAt[cell])!;
      this.player.set(withoutShipAt(board, cell));
      this.pickedSize.set(removed.size);
      this.audio.rotate();
      this.message.set({ key: 'msg.shipRemoved', params: { size: removed.size } });
      return;
    }

    const size = this.pickedSize();
    if (size === null) {
      this.message.set({ key: 'msg.pickFirst' });
      return;
    }
    const left = this.roster().find((r) => r.size === size)?.left ?? 0;
    if (left <= 0) {
      this.message.set({ key: 'msg.allPlaced', params: { size } });
      return;
    }

    const row = Math.floor(cell / 10);
    const col = cell % 10;
    if (!canPlace(board, row, col, size, this.orient())) {
      this.message.set({ key: 'msg.noRoom' });
      return;
    }

    this.player.set(withShip(board, row, col, size, this.orient()));
    this.audio.place();
    this.autoPickNext();
    this.message.set({ key: this.fleetReady() ? 'msg.fleetReady' : 'msg.keepPlacing' });
  }

  autoPlace(): void {
    if (this.phase() !== 'deploy') return;
    // The same mooring the opponent gives itself — a player who asks for a draw
    // should not be handed a worse deployment than the computer keeps for itself.
    this.player.set(hiddenBoard(this.rng, 'player'));
    this.pickedSize.set(null);
    this.audio.place();
    this.message.set({ key: 'msg.autoPlaced' });
  }

  clearBoard(): void {
    if (this.phase() !== 'deploy') return;
    this.player.set(emptyBoard('player'));
    this.pickedSize.set(4);
    this.audio.rotate();
    this.message.set({ key: 'msg.cleared' });
  }

  setDifficulty(level: Difficulty): void {
    if (this.phase() === 'battle') return;
    this.difficulty.set(level);
  }

  /* ── the battle ─────────────────────────────────────────────────────── */

  beginBattle(): void {
    if (!this.fleetReady()) return;
    this.phase.set('battle');
    this.turn.set('player');
    this.hover.set(null);
    this.pickedSize.set(null);
    this.message.set({ key: 'msg.yourSalvo' });
    this.audio.ping();
  }

  /** The player's shot into the opponent's waters. */
  fireAt(cell: number): void {
    if (!this.canFire()) return;
    const board = this.enemy();
    if (board.shots[cell] !== 'unknown') return;

    this.busy.set(true);
    const era = this.era;
    const outcome = fire(board, cell);
    this.enemy.set(outcome.board);
    this.playerTally.update((t) => ({
      shots: t.shots + 1,
      hits: t.hits + (outcome.result === 'miss' ? 0 : 1),
    }));
    this.record('player', cell, outcome.result, outcome.result === 'sunk' ? outcome.ship!.size : null);
    this.report(cell, outcome.result);

    // the message is written before the check for a destroyed fleet: the
    // deciding salvo has to be called out too
    this.message.set(
      outcome.result === 'miss'
        ? { key: 'msg.miss' }
        : outcome.result === 'sunk'
          ? { key: 'msg.enemySunk', params: { size: outcome.ship!.size } }
          : { key: 'msg.hit' },
    );

    if (isFleetDestroyed(outcome.board)) {
      this.after(PAUSE.beforeFinish, era, () => this.finish('player'));
      return;
    }

    if (outcome.result === 'miss') {
      this.turn.set('enemy');
      this.after(PAUSE.enemyThinks, era, () => this.enemyVolley());
    } else {
      this.after(PAUSE.afterHit, era, () => this.busy.set(false));
    }
  }

  /** The opponent's move: it keeps firing for as long as it keeps hitting. */
  private enemyVolley(): void {
    const era = this.era;
    const board = this.player();
    const cell = chooseShot(board.shots, afloatSizes(board), this.difficulty(), this.rng);
    if (cell === -1) {
      // unreachable while a fleet is alive, but the turn has to come back either way
      this.turn.set('player');
      this.busy.set(false);
      this.message.set({ key: 'msg.enemyStuck' });
      return;
    }

    // taken before the shot lands: this is what it knew when it chose
    const reckoned =
      this.difficulty() === 'admiral'
        ? densityMap(board.shots, afloatSizes(board)).score
        : null;

    const outcome = fire(board, cell);
    this.player.set(outcome.board);
    if (reckoned) {
      this.reckoning.update((log) => [
        ...log,
        { shots: board.shots, score: reckoned, cell, result: outcome.result },
      ]);
    }
    this.enemyTally.update((t) => ({
      shots: t.shots + 1,
      hits: t.hits + (outcome.result === 'miss' ? 0 : 1),
    }));
    this.record('enemy', cell, outcome.result, outcome.result === 'sunk' ? outcome.ship!.size : null);
    this.report(cell, outcome.result, 'enemy');

    if (outcome.result !== 'miss') {
      this.message.set(
        outcome.result === 'sunk'
          ? { key: 'msg.yourShipSunk', params: { cell, size: outcome.ship!.size } }
          : { key: 'msg.yourShipHit', params: { cell } },
      );
    }

    if (isFleetDestroyed(outcome.board)) {
      this.after(PAUSE.beforeFinish, era, () => this.finish('enemy'));
      return;
    }

    if (outcome.result === 'miss') {
      this.after(PAUSE.turnBack, era, () => {
        this.turn.set('player');
        this.busy.set(false);
        this.message.set({ key: 'msg.enemyMiss', params: { cell } });
      });
    } else {
      this.after(PAUSE.enemyVolley, era, () => this.enemyVolley());
    }
  }

  private finish(winner: Side): void {
    this.phase.set('over');
    this.winner.set(winner);
    this.busy.set(false);
    this.message.set({ key: winner === 'player' ? 'msg.won' : 'msg.lost' });
    if (winner === 'player') this.audio.victory();
    else this.audio.defeat();
    this.after(PAUSE.beforeVerdict, this.era, () => {
      if (!this.verdictDismissed) this.verdictOpen.set(true);
    });
  }

  /** Show the Admiral's reckoning over your own chart, from its first salvo. */
  openReplay(): void {
    if (!this.reckoning().length) return;
    this.verdictDismissed = true;
    this.verdictOpen.set(false);
    this.replayAt.set(0);
    this.replayOpen.set(true);
  }

  closeReplay(): void {
    this.replayOpen.set(false);
  }

  showSalvo(n: number): void {
    const last = this.reckoning().length - 1;
    this.replayAt.set(Math.max(0, Math.min(n, last)));
  }

  closeVerdict(): void {
    this.verdictDismissed = true;
    this.verdictOpen.set(false);
  }

  newGame(): void {
    this.era++;
    this.phase.set('deploy');
    this.player.set(emptyBoard('player'));
    this.enemy.set(hiddenBoard(this.rng, 'enemy'));
    this.turn.set('player');
    this.busy.set(false);
    this.winner.set(null);
    this.verdictOpen.set(false);
    this.verdictDismissed = false;
    this.log.set([]);
    this.splash.set(null);
    this.reckoning.set([]);
    this.replayOpen.set(false);
    this.replayAt.set(0);
    this.playerTally.set({ shots: 0, hits: 0 });
    this.enemyTally.set({ shots: 0, hits: 0 });
    this.pickedSize.set(4);
    this.orient.set('h');
    this.hover.set(null);
    this.message.set({ key: 'msg.deploy' });
  }

  /** A rematch: the opponent's old deployment will not do — a fresh battle. */
  rematch(): void {
    this.newGame();
    this.autoPlace();
  }

  /* ── housekeeping ───────────────────────────────────────────────────── */

  private autoPickNext(): void {
    const next = this.roster().find((r) => r.left > 0);
    this.pickedSize.set(next ? next.size : null);
  }

  private record(side: Side, cell: number, result: ShotResult, size: number | null): void {
    const entry: LogEntry = {
      id: this.logSeq++,
      side,
      cell,
      result,
      shipSize: size,
    };
    this.log.update((l) => [entry, ...l].slice(0, 60));
  }

  private report(cell: number, result: ShotResult, side: Side = 'player'): void {
    this.splash.set({ id: this.splashSeq++, side, cell, result });
    if (result === 'miss') this.audio.splash();
    else if (result === 'hit') this.audio.hit();
    else this.audio.sunk();
  }

  private after(ms: number, era: number, run: () => void): void {
    setTimeout(() => {
      if (era === this.era) run();
    }, ms);
  }
}

function summarise(t: Tally) {
  return {
    shots: t.shots,
    hits: t.hits,
    accuracy: t.shots ? Math.round((t.hits / t.shots) * 100) : 0,
  };
}
