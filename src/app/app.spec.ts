import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { GAME_SEED, GameStore } from './core/game-store';
import { idx } from './domain/grid';

/**
 * Сборка целиком: хранилище, обе карты и стойка приборов вместе.
 * Здесь проверяется то, что не видно по отдельности — например, что на ходу
 * противника чужой квадрат действительно закрыт для щелчков.
 */
describe('App', () => {
  let fixture: ComponentFixture<App>;
  let store: GameStore;

  const boards = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('app-board-grid'));

  const homeCells = (): HTMLButtonElement[] =>
    Array.from(boards()[0].querySelectorAll('button.cell'));

  const enemyCells = (): HTMLButtonElement[] =>
    Array.from(boards()[1].querySelectorAll('button.cell'));

  const render = (seed = 2024) => {
    TestBed.configureTestingModule({ providers: [{ provide: GAME_SEED, useValue: seed }] });
    store = TestBed.inject(GameStore);
    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('показывает оба квадрата и стойку', () => {
    render();
    expect(boards()).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('app-deploy-panel')).toBeTruthy();
  });

  describe('расстановка', () => {
    it('своя карта открыта, чужая закрыта', () => {
      render();
      expect(homeCells().every((b) => b.getAttribute('aria-disabled') === 'false')).toBe(true);
      expect(enemyCells().every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true);
    });

    it('щелчок по своей карте ставит выбранный корабль', () => {
      render();
      store.pickSize(4);
      fixture.detectChanges();

      homeCells()[idx(2, 1)].click();
      fixture.detectChanges();

      expect(store.player().ships).toHaveLength(1);
      expect(store.player().ships[0].cells).toEqual([idx(2, 1), idx(2, 2), idx(2, 3), idx(2, 4)]);
    });

    it('повторный щелчок по кораблю снимает его', () => {
      render();
      store.pickSize(3);
      fixture.detectChanges();
      homeCells()[idx(5, 5)].click();
      fixture.detectChanges();
      expect(store.player().ships).toHaveLength(1);

      homeCells()[idx(5, 6)].click();
      fixture.detectChanges();
      expect(store.player().ships).toHaveLength(0);
    });

    it('R поворачивает корабль', () => {
      render();
      expect(store.orient()).toBe('h');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
      fixture.detectChanges();
      expect(store.orient()).toBe('v');
    });

    it('в бою R уже ничего не поворачивает', () => {
      render();
      store.autoPlace();
      store.beginBattle();
      fixture.detectChanges();

      const before = store.orient();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
      expect(store.orient()).toBe(before);
    });
  });

  describe('бой', () => {
    const toBattle = (seed = 2024) => {
      render(seed);
      store.autoPlace();
      store.beginBattle();
      fixture.detectChanges();
    };

    it('чужая карта открывается, своя закрывается', () => {
      toBattle();
      expect(enemyCells().every((b) => b.getAttribute('aria-disabled') === 'false')).toBe(true);
      expect(homeCells().every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true);
    });

    it('стойка сменилась на донесение', () => {
      toBattle();
      expect(fixture.nativeElement.querySelector('app-battle-panel')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-deploy-panel')).toBeNull();
    });

    it('щелчок по чужой клетке стреляет', () => {
      toBattle();
      const target = store.enemy().ships[0].cells[0];
      enemyCells()[target].click();
      vi.advanceTimersByTime(1000);
      fixture.detectChanges();

      expect(store.playerStats().shots).toBe(1);
      expect(enemyCells()[target].classList.contains('hit') || enemyCells()[target].classList.contains('sunk')).toBe(true);
    });

    it('на ходу противника чужой квадрат закрыт для щелчков', () => {
      toBattle();
      const miss = store.enemy().shipAt.findIndex((v) => v === -1);
      enemyCells()[miss].click();
      fixture.detectChanges();

      expect(store.turn()).toBe('enemy');
      expect(enemyCells().every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true);
    });

    it('когда ход вернулся, квадрат снова открыт', () => {
      toBattle();
      const miss = store.enemy().shipAt.findIndex((v) => v === -1);
      enemyCells()[miss].click();
      vi.advanceTimersByTime(20000);
      fixture.detectChanges();

      expect(store.turn()).toBe('player');
      expect(enemyCells().every((b) => b.getAttribute('aria-disabled') === 'false')).toBe(true);
    });

    it('строка состояния объявляет, чей ход', () => {
      toBattle();
      expect(fixture.nativeElement.querySelector('.rail__turn').textContent).toContain('Ваш ход');
    });
  });

  describe('конец партии', () => {
    it('итоговая карточка появляется после съёмки квадрата', () => {
      render(3);
      store.autoPlace();
      store.beginBattle();

      for (const cell of store.enemy().ships.flatMap((s) => s.cells)) {
        store.fireAt(cell);
        vi.advanceTimersByTime(1000);
      }
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-result-overlay')).toBeNull();

      vi.advanceTimersByTime(5000);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-result-overlay')).toBeTruthy();
    });

    it('после боя чужой флот нанесён на карту целиком', () => {
      render(3);
      store.autoPlace();
      store.beginBattle();
      for (const cell of store.enemy().ships.flatMap((s) => s.cells)) {
        store.fireAt(cell);
        vi.advanceTimersByTime(1000);
      }
      vi.advanceTimersByTime(5000);
      fixture.detectChanges();

      expect(boards()[1].querySelectorAll('div.hull')).toHaveLength(10);
    });
  });
});
