import { Injectable, computed, inject, signal } from '@angular/core';
import { chooseShot } from '../ai/opponent';
import { Difficulty } from '../ai/levels';
import { AudioService } from './audio';
import { Board, ShotResult, emptyBoard } from '../domain/board';
import { FLEET_SHIPS, FLEET_SPEC, isSunk, shipName } from '../domain/fleet';
import { Orientation, Side, coordLabel } from '../domain/grid';
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

export type Phase = 'deploy' | 'battle' | 'over';

export interface LogEntry {
  id: number;
  side: Side;
  cell: string;
  result: ShotResult;
  ship: string | null;
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

  /**
   * Единственный источник случайности партии. Засеян энтропией, но засеян —
   * значит, партию можно воспроизвести, подменив зерно в тестах.
   */
  private rng = seededRng(entropySeed());

  /* ── состояние партии ───────────────────────────────────────────────── */

  readonly phase = signal<Phase>('deploy');
  readonly difficulty = signal<Difficulty>('michman');
  readonly player = signal<Board>(emptyBoard('player'));
  readonly enemy = signal<Board>(randomBoard(this.rng, 'enemy'));
  readonly turn = signal<Side>('player');
  /** Ход в процессе: анимация выстрела или раздумье противника. */
  readonly busy = signal(false);
  readonly winner = signal<Side | null>(null);
  /** Итоговая карточка ждёт, пока квадрат ляжет на бумагу, и её можно убрать. */
  readonly verdictOpen = signal(false);
  readonly log = signal<LogEntry[]>([]);
  readonly splash = signal<Splash | null>(null);
  readonly message = signal('Расставьте флот в своих водах');

  private readonly playerTally = signal<Tally>({ shots: 0, hits: 0 });
  private readonly enemyTally = signal<Tally>({ shots: 0, hits: 0 });

  /* ── расстановка ────────────────────────────────────────────────────── */

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

  /** Силуэт под курсором во время расстановки: где встанет корабль и можно ли. */
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

  /* ── сводка боя ─────────────────────────────────────────────────────── */

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

  readonly canFire = computed(
    () => this.phase() === 'battle' && this.turn() === 'player' && !this.busy(),
  );

  /** Растёт при каждом новом бое — гасит таймеры прошлой партии. */
  private era = 0;
  /** Итог уже убирали руками — карточка не должна всплыть снова по таймеру. */
  private verdictDismissed = false;
  private logSeq = 0;
  private splashSeq = 0;

  /* ── расстановка: действия ──────────────────────────────────────────── */

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

  /** Клик по своей карте: поставить выбранный корабль или снять уже стоящий. */
  placeAt(cell: number): void {
    if (this.phase() !== 'deploy') return;
    const board = this.player();

    if (board.shipAt[cell] !== -1) {
      const removed = board.ships.find((s) => s.id === board.shipAt[cell])!;
      this.player.set(withoutShipAt(board, cell));
      this.pickedSize.set(removed.size);
      this.audio.rotate();
      this.message.set(`${shipName(removed.size)} снят с карты`);
      return;
    }

    const size = this.pickedSize();
    if (size === null) {
      this.message.set('Сначала выберите корабль в составе флота');
      return;
    }
    const left = this.roster().find((r) => r.size === size)?.left ?? 0;
    if (left <= 0) {
      this.message.set(`${shipName(size)} уже весь на карте`);
      return;
    }

    const row = Math.floor(cell / 10);
    const col = cell % 10;
    if (!canPlace(board, row, col, size, this.orient())) {
      this.message.set('Здесь не встанет: корабли не соприкасаются даже углами');
      return;
    }

    this.player.set(withShip(board, row, col, size, this.orient()));
    this.audio.place();
    this.autoPickNext();
    this.message.set(
      this.fleetReady() ? 'Флот на позиции. К бою!' : 'Продолжайте расстановку',
    );
  }

  autoPlace(): void {
    if (this.phase() !== 'deploy') return;
    this.player.set(randomBoard(this.rng, 'player'));
    this.pickedSize.set(null);
    this.audio.place();
    this.message.set('Флот расставлен по жребию. Можно менять — щёлкните по кораблю.');
  }

  clearBoard(): void {
    if (this.phase() !== 'deploy') return;
    this.player.set(emptyBoard('player'));
    this.pickedSize.set(4);
    this.audio.rotate();
    this.message.set('Карта чиста. Начнём заново.');
  }

  setDifficulty(level: Difficulty): void {
    if (this.phase() === 'battle') return;
    this.difficulty.set(level);
  }

  /* ── бой ────────────────────────────────────────────────────────────── */

  beginBattle(): void {
    if (!this.fleetReady()) return;
    this.phase.set('battle');
    this.turn.set('player');
    this.hover.set(null);
    this.pickedSize.set(null);
    this.message.set('Ваш залп. Называйте квадрат.');
    this.audio.ping();
  }

  /** Выстрел игрока по водам противника. */
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

    // сообщение пишется до проверки на разгром: решающий залп тоже надо назвать
    this.message.set(
      outcome.result === 'miss'
        ? 'Мимо. Противник берёт прицел.'
        : outcome.result === 'sunk'
          ? `${shipName(outcome.ship!.size)} противника потоплен. Стреляйте снова!`
          : 'Попадание! Стреляйте снова.',
    );

    if (isFleetDestroyed(outcome.board)) {
      this.after(900, era, () => this.finish('player'));
      return;
    }

    if (outcome.result === 'miss') {
      this.turn.set('enemy');
      this.after(950, era, () => this.enemyVolley());
    } else {
      this.after(420, era, () => this.busy.set(false));
    }
  }

  /** Ход противника: он бьёт, пока попадает. */
  private enemyVolley(): void {
    const era = this.era;
    const board = this.player();
    const cell = chooseShot(board.shots, afloatSizes(board), this.difficulty(), this.rng);
    if (cell === -1) {
      // недостижимо при живом флоте, но ход обязан вернуться игроку в любом случае
      this.turn.set('player');
      this.busy.set(false);
      this.message.set('Противнику некуда стрелять. Ваш ход.');
      return;
    }

    const outcome = fire(board, cell);
    this.player.set(outcome.board);
    this.enemyTally.update((t) => ({
      shots: t.shots + 1,
      hits: t.hits + (outcome.result === 'miss' ? 0 : 1),
    }));
    this.record('enemy', cell, outcome.result, outcome.result === 'sunk' ? outcome.ship!.size : null);
    this.report(cell, outcome.result, 'enemy');

    if (outcome.result !== 'miss') {
      this.message.set(
        outcome.result === 'sunk'
          ? `${coordLabel(cell)} — ваш ${shipName(outcome.ship!.size).toLowerCase()} потоплен`
          : `${coordLabel(cell)} — попадание в ваш корабль`,
      );
    }

    if (isFleetDestroyed(outcome.board)) {
      this.after(900, era, () => this.finish('enemy'));
      return;
    }

    if (outcome.result === 'miss') {
      this.after(600, era, () => {
        this.turn.set('player');
        this.busy.set(false);
        this.message.set(`Противник бьёт в ${coordLabel(cell)} — мимо. Ваш ход.`);
      });
    } else {
      this.after(1050, era, () => this.enemyVolley());
    }
  }

  private finish(winner: Side): void {
    this.phase.set('over');
    this.winner.set(winner);
    this.busy.set(false);
    this.message.set(
      winner === 'player' ? 'Эскадра противника уничтожена' : 'Ваш флот лежит на дне',
    );
    if (winner === 'player') this.audio.victory();
    else this.audio.defeat();
    this.after(1500, this.era, () => {
      if (!this.verdictDismissed) this.verdictOpen.set(true);
    });
  }

  closeVerdict(): void {
    this.verdictDismissed = true;
    this.verdictOpen.set(false);
  }

  newGame(): void {
    this.era++;
    this.phase.set('deploy');
    this.player.set(emptyBoard('player'));
    this.enemy.set(randomBoard(this.rng, 'enemy'));
    this.turn.set('player');
    this.busy.set(false);
    this.winner.set(null);
    this.verdictOpen.set(false);
    this.verdictDismissed = false;
    this.log.set([]);
    this.splash.set(null);
    this.playerTally.set({ shots: 0, hits: 0 });
    this.enemyTally.set({ shots: 0, hits: 0 });
    this.pickedSize.set(4);
    this.orient.set('h');
    this.hover.set(null);
    this.message.set('Расставьте флот в своих водах');
  }

  /** Пересдача: та же расстановка противника уже не годится — новый бой. */
  rematch(): void {
    this.newGame();
    this.autoPlace();
  }

  /* ── служебное ──────────────────────────────────────────────────────── */

  private autoPickNext(): void {
    const next = this.roster().find((r) => r.left > 0);
    this.pickedSize.set(next ? next.size : null);
  }

  private record(side: Side, cell: number, result: ShotResult, size: number | null): void {
    const entry: LogEntry = {
      id: this.logSeq++,
      side,
      cell: coordLabel(cell),
      result,
      ship: size !== null ? shipName(size) : null,
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
