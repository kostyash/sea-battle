import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { GAME_SEED, GameStore } from './core/game-store';
import { idx } from './domain/grid';
import { I18n } from './i18n/i18n';

/**
 * The whole assembly: the store, both charts and the instrument rack together.
 * What is checked here is what none of them shows on its own — that on the
 * opponent's move, for instance, their square really is shut to clicks.
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
    // storage and the <html> attributes are swept by `src/test-setup.ts`
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows both squares and the rack', () => {
    render();
    expect(boards()).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('app-deploy-panel')).toBeTruthy();
  });

  describe('deployment', () => {
    it("your own chart is open, the opponent's is shut", () => {
      render();
      expect(homeCells().every((b) => b.getAttribute('aria-disabled') === 'false')).toBe(true);
      expect(enemyCells().every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true);
    });

    it('a click on your own chart puts the picked ship down', () => {
      render();
      store.pickSize(4);
      fixture.detectChanges();

      homeCells()[idx(2, 1)].click();
      fixture.detectChanges();

      expect(store.player().ships).toHaveLength(1);
      expect(store.player().ships[0].cells).toEqual([idx(2, 1), idx(2, 2), idx(2, 3), idx(2, 4)]);
    });

    it('a second click on a ship takes it back off', () => {
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

    it('R turns the ship', () => {
      render();
      expect(store.orient()).toBe('h');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
      fixture.detectChanges();
      expect(store.orient()).toBe('v');
    });

    it('the Cyrillic and Hebrew R turn it too — R sits on that key in every layout', () => {
      render();
      for (const key of ['к', 'ר']) {
        const before = store.orient();
        document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        fixture.detectChanges();
        expect(store.orient()).not.toBe(before);
      }
    });

    it('in battle R turns nothing any more', () => {
      render();
      store.autoPlace();
      store.beginBattle();
      fixture.detectChanges();

      const before = store.orient();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
      expect(store.orient()).toBe(before);
    });
  });

  describe('battle', () => {
    const toBattle = (seed = 2024) => {
      render(seed);
      store.autoPlace();
      store.beginBattle();
      fixture.detectChanges();
    };

    it("the opponent's chart opens, your own shuts", () => {
      toBattle();
      expect(enemyCells().every((b) => b.getAttribute('aria-disabled') === 'false')).toBe(true);
      expect(homeCells().every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true);
    });

    it('the rack changes over to the report', () => {
      toBattle();
      expect(fixture.nativeElement.querySelector('app-battle-panel')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-deploy-panel')).toBeNull();
    });

    it("a click on one of the opponent's cells fires at it", () => {
      toBattle();
      const target = store.enemy().ships[0].cells[0];
      enemyCells()[target].click();
      vi.advanceTimersByTime(1000);
      fixture.detectChanges();

      expect(store.playerStats().shots).toBe(1);
      expect(
        enemyCells()[target].classList.contains('hit') ||
          enemyCells()[target].classList.contains('sunk'),
      ).toBe(true);
    });

    it("on the opponent's move their square is shut to clicks", () => {
      toBattle();
      const miss = store.enemy().shipAt.findIndex((v) => v === -1);
      enemyCells()[miss].click();
      fixture.detectChanges();

      expect(store.turn()).toBe('enemy');
      expect(enemyCells().every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true);
    });

    it('once the move has come back the square is open again', () => {
      toBattle();
      const miss = store.enemy().shipAt.findIndex((v) => v === -1);
      enemyCells()[miss].click();
      vi.advanceTimersByTime(20000);
      fixture.detectChanges();

      expect(store.turn()).toBe('player');
      expect(enemyCells().every((b) => b.getAttribute('aria-disabled') === 'false')).toBe(true);
    });

    it('the status line announces whose move it is', () => {
      toBattle();
      expect(fixture.nativeElement.querySelector('.rail__turn').textContent).toContain('Your move');
    });
  });

  describe('the end of a game', () => {
    it('the result card comes up once the square has been charted', () => {
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

    /**
     * The card calls itself `aria-modal`, which tells a screen reader the rest of
     * the page is not there. Without `inert` that is only a claim: Tab walked out
     * of the card and into the masthead — where the language switch now sits — and
     * a reader would refuse to describe what the keyboard had landed on.
     */
    it('everything behind the result card goes inert, so the keyboard cannot walk out of it', () => {
      render(3);
      store.autoPlace();
      store.beginBattle();
      const deck = (): HTMLElement => fixture.nativeElement.querySelector('.deck');
      expect(deck().hasAttribute('inert')).toBe(false);

      store.verdictOpen.set(true);
      fixture.detectChanges();
      expect(deck().hasAttribute('inert')).toBe(true);

      store.closeVerdict();
      fixture.detectChanges();
      expect(deck().hasAttribute('inert')).toBe(false);
    });

    it("after the battle the opponent's fleet is drawn onto the chart in full", () => {
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

  describe('the language', () => {
    it('puts the chosen language and its direction on <html> — a screen reader needs both', () => {
      render();
      const root = document.documentElement;
      expect(root.getAttribute('lang')).toBe('en');
      expect(root.getAttribute('dir')).toBe('ltr');

      TestBed.inject(I18n).setLang('ru');
      fixture.detectChanges();
      expect(root.getAttribute('lang')).toBe('ru');
      expect(root.getAttribute('dir')).toBe('ltr');

      TestBed.inject(I18n).setLang('he');
      fixture.detectChanges();
      expect(root.getAttribute('lang')).toBe('he');
      // Hebrew is the only one of the three that reads the other way
      expect(root.getAttribute('dir')).toBe('rtl');
    });

    it('re-reads the status line in the new language — the store kept a key, not words', () => {
      render();
      store.autoPlace();
      store.beginBattle();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.rail__turn').textContent).toContain('Your move');

      TestBed.inject(I18n).setLang('ru');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.rail__turn').textContent).toContain('Ваш ход');
    });
  });
});
