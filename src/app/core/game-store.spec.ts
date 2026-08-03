import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Board } from '../domain/board';
import { FLEET_SHIPS, TOTAL_DECKS } from '../domain/fleet';
import { SIZE, idx } from '../domain/grid';
import { canonicalBoard } from '../domain/placement';
import { GAME_SEED, GameStore, PAUSE } from './game-store';

/**
 * Хранилище живёт на таймерах: между залпами стоят паузы под анимацию.
 * Тесты крутят время сами, поэтому партия проходит мгновенно и предсказуемо.
 */
const make = (seed = 12345): GameStore => {
  TestBed.configureTestingModule({ providers: [{ provide: GAME_SEED, useValue: seed }] });
  return TestBed.inject(GameStore);
};

/** Прокручивает все отложенные ходы, пока партия не успокоится. */
const settle = (ms = 20000): void => {
  vi.advanceTimersByTime(ms);
};

/**
 * Пауза после собственного попадания — ровно столько, сколько ждёт хранилище.
 * Раньше здесь стояло магическое 1000, подобранное между 900 и 420: любая
 * правка анимаций ломала бы тесты сообщением «ожидался over, получен battle».
 */
const afterOwnHit = (): void => {
  vi.advanceTimersByTime(PAUSE.afterHit + PAUSE.beforeFinish);
};

/** Все клетки кораблей поля — по ним бьют, чтобы гарантированно топить. */
const shipCellsOf = (board: Board): number[] => board.ships.flatMap((s) => s.cells);

describe('GameStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('начало партии', () => {
    it('стартует в расстановке с пустым своим полем и готовым чужим', () => {
      const store = make();
      expect(store.phase()).toBe('deploy');
      expect(store.player().ships).toHaveLength(0);
      expect(store.enemy().ships).toHaveLength(FLEET_SHIPS);
      expect(store.winner()).toBeNull();
    });

    it('одно зерно — та же расстановка противника', () => {
      const a = make(777).enemy().shipAt;
      TestBed.resetTestingModule();
      const b = make(777).enemy().shipAt;
      expect(b).toEqual(a);
    });

    it('в бой без полного флота не пускает', () => {
      const store = make();
      store.beginBattle();
      expect(store.phase()).toBe('deploy');
    });
  });

  describe('расстановка', () => {
    it('корабль встаёт по щелчку и список уменьшается', () => {
      const store = make();
      store.pickSize(4);
      store.placeAt(idx(0, 0));
      expect(store.player().ships).toHaveLength(1);
      expect(store.roster().find((r) => r.size === 4)?.left).toBe(0);
    });

    it('после постановки сам выбирается следующий калибр', () => {
      const store = make();
      store.pickSize(4);
      store.placeAt(idx(0, 0));
      expect(store.pickedSize()).toBe(3);
    });

    it('вплотную к соседу не ставит и объясняет почему', () => {
      const store = make();
      store.pickSize(4);
      store.placeAt(idx(0, 0));
      store.pickSize(3);
      store.placeAt(idx(1, 0));
      expect(store.player().ships).toHaveLength(1);
      expect(store.message()).toMatch(/не встанет/i);
    });

    it('щелчок по стоящему кораблю снимает его и возвращает в состав', () => {
      const store = make();
      store.pickSize(4);
      store.placeAt(idx(0, 0));
      store.placeAt(idx(0, 1));
      expect(store.player().ships).toHaveLength(0);
      expect(store.pickedSize()).toBe(4);
    });

    it('поворот меняет ориентацию', () => {
      const store = make();
      expect(store.orient()).toBe('h');
      store.rotate();
      expect(store.orient()).toBe('v');
    });

    it('жребий расставляет весь флот', () => {
      const store = make();
      store.autoPlace();
      expect(store.player().ships).toHaveLength(FLEET_SHIPS);
      expect(store.fleetReady()).toBe(true);
    });

    it('очистка убирает всё', () => {
      const store = make();
      store.autoPlace();
      store.clearBoard();
      expect(store.player().ships).toHaveLength(0);
      expect(store.fleetReady()).toBe(false);
    });

    it('силуэт под курсором показывает выбранный калибр целиком', () => {
      const store = make();
      store.pickSize(4);
      store.setHover(idx(5, 0));
      expect(store.ghost()?.cells).toHaveLength(4);
      expect(store.ghost()?.valid).toBe(true);
    });

    it('силуэт у края помечается недопустимым', () => {
      const store = make();
      store.pickSize(4);
      store.setHover(idx(5, 9));
      expect(store.ghost()?.valid).toBe(false);
    });
  });

  describe('порядок ходов', () => {
    const ready = (seed = 1): GameStore => {
      const store = make(seed);
      store.autoPlace();
      store.beginBattle();
      return store;
    };

    it('бой начинается с хода игрока', () => {
      const store = ready();
      expect(store.phase()).toBe('battle');
      expect(store.turn()).toBe('player');
      expect(store.canFire()).toBe(true);
    });

    it('попал — стреляешь снова: ход остаётся у игрока', () => {
      const store = ready();
      const target = shipCellsOf(store.enemy())[0];
      store.fireAt(target);
      afterOwnHit();
      expect(store.turn()).toBe('player');
      expect(store.canFire()).toBe(true);
    });

    it('промахнулся — ход уходит противнику', () => {
      const store = ready();
      const miss = store.enemy().shipAt.findIndex((v) => v === -1);
      store.fireAt(miss);
      expect(store.turn()).toBe('enemy');
      expect(store.canFire()).toBe(false);
    });

    it('пока противник думает, стрелять нельзя', () => {
      const store = ready();
      const miss = store.enemy().shipAt.findIndex((v) => v === -1);
      store.fireAt(miss);
      const before = store.enemy().shots.filter((s) => s !== 'unknown').length;
      store.fireAt(shipCellsOf(store.enemy())[0]);
      expect(store.enemy().shots.filter((s) => s !== 'unknown').length).toBe(before);
    });

    it('после промаха противника ход возвращается', () => {
      const store = ready();
      const miss = store.enemy().shipAt.findIndex((v) => v === -1);
      store.fireAt(miss);
      settle();
      expect(store.turn()).toBe('player');
      expect(store.busy()).toBe(false);
    });

    it('дважды по одной клетке не выстрелить', () => {
      const store = ready();
      const target = shipCellsOf(store.enemy())[0];
      store.fireAt(target);
      afterOwnHit();
      const shots = store.playerStats().shots;
      store.fireAt(target);
      expect(store.playerStats().shots).toBe(shots);
    });
  });

  describe('победа', () => {
    it('расстрел всего вражеского флота заканчивает партию победой', () => {
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
      expect(store.message()).toMatch(/уничтожена/i);
    });

    it('итоговая карточка появляется не сразу, а после съёмки квадрата', () => {
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

    it('убранная карточка не всплывает обратно по таймеру', () => {
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

    it('после победы выстрелы больше не проходят', () => {
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

  describe('поражение', () => {
    it('противник, добивший флот игрока, выигрывает партию', () => {
      const store = make(5);
      store.autoPlace();
      store.beginBattle();

      // Игрок только промахивается, противник спокойно доигрывает своё.
      for (let n = 0; n < 400 && store.phase() === 'battle'; n++) {
        if (store.canFire()) {
          const miss = store.enemy().shots.findIndex(
            (s, i) => s === 'unknown' && store.enemy().shipAt[i] === -1,
          );
          if (miss === -1) break;
          store.fireAt(miss);
        }
        settle(3000);
      }

      expect(store.phase()).toBe('over');
      expect(store.winner()).toBe('enemy');
      expect(store.playerDecksLeft()).toBe(0);
      expect(store.message()).toMatch(/на дне/i);
    });
  });

  describe('статистика и журнал', () => {
    it('считает залпы, попадания и точность', () => {
      const store = make(7);
      store.autoPlace();
      store.beginBattle();

      const hit = shipCellsOf(store.enemy())[0];
      store.fireAt(hit);
      afterOwnHit();
      expect(store.playerStats()).toMatchObject({ shots: 1, hits: 1, accuracy: 100 });

      const miss = store.enemy().shots.findIndex(
        (s, i) => s === 'unknown' && store.enemy().shipAt[i] === -1,
      );
      store.fireAt(miss);
      expect(store.playerStats()).toMatchObject({ shots: 2, hits: 1, accuracy: 50 });
    });

    it('на нулевых залпах точность нулевая, а не деление на ноль', () => {
      const store = make();
      expect(store.playerStats().accuracy).toBe(0);
    });

    it('журнал пишет координату и исход, новое сверху', () => {
      const store = make(7);
      store.autoPlace();
      store.beginBattle();
      const hit = shipCellsOf(store.enemy())[0];
      store.fireAt(hit);
      afterOwnHit();

      const top = store.log()[0];
      expect(top.side).toBe('player');
      expect(top.cell).toMatch(/^[А-Я]\d+$/);
      expect(['hit', 'sunk']).toContain(top.result);
    });

    it('журнал не разрастается без предела', () => {
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

  describe('новая партия', () => {
    it('сбрасывает поле, счёт и журнал', () => {
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

    it('пересдача сразу ставит флот и ждёт команды к бою', () => {
      const store = make(11);
      store.rematch();
      expect(store.phase()).toBe('deploy');
      expect(store.fleetReady()).toBe(true);
    });

    it('отложенные ходы прошлой партии не трогают новую', () => {
      const store = make(13);
      store.autoPlace();
      store.beginBattle();
      const miss = store.enemy().shipAt.findIndex((v) => v === -1);
      store.fireAt(miss); // противник получил ход и думает

      store.newGame();
      const clean = store.player().shots.filter((s) => s !== 'unknown').length;
      settle();

      expect(store.player().shots.filter((s) => s !== 'unknown').length).toBe(clean);
      expect(store.phase()).toBe('deploy');
    });
  });

  describe('уровень противника', () => {
    it('меняется до боя', () => {
      const store = make();
      store.setDifficulty('admiral');
      expect(store.difficulty()).toBe('admiral');
    });

    it('в разгар боя не меняется', () => {
      const store = make();
      store.autoPlace();
      store.beginBattle();
      store.setDifficulty('admiral');
      expect(store.difficulty()).toBe('michman');
    });
  });

  describe('целостность поля', () => {
    it('у игрока ровно двадцать палуб после жребия', () => {
      const store = make(17);
      store.autoPlace();
      expect(store.player().shipAt.filter((v) => v !== -1)).toHaveLength(TOTAL_DECKS);
      expect(store.playerDecksLeft()).toBe(TOTAL_DECKS);
    });

    it('расстановка вручную даёт то же, что и заготовленная', () => {
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
