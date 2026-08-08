import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_SEED, GameStore } from '../core/game-store';
import { FLEET_SHIPS } from '../domain/fleet';
import { I18n } from '../i18n/i18n';
import { BattlePanel } from './battle-panel';
import { DeployPanel } from './deploy-panel';
import { ResultOverlay } from './result-overlay';

const text = (fixture: ComponentFixture<unknown>): string =>
  (fixture.nativeElement as HTMLElement).textContent ?? '';

const buttons = (fixture: ComponentFixture<unknown>, selector: string): HTMLButtonElement[] =>
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(selector));

/**
 * A square as the player would call it out, spelled here rather than asked of
 * `I18n`: an assertion that borrowed the very code it is checking would agree
 * with any answer that code gave and would pin nothing.
 */
const ROW_LETTERS = { en: 'ABCDEFGHIJ', ru: 'АБВГДЕЖЗИК' } as const;

const coord = (cell: number, lang: keyof typeof ROW_LETTERS): string =>
  `${ROW_LETTERS[lang][Math.floor(cell / 10)]}${(cell % 10) + 1}`;

const setup = (seed = 4242): GameStore => {
  TestBed.configureTestingModule({ providers: [{ provide: GAME_SEED, useValue: seed }] });
  return TestBed.inject(GameStore);
};

describe('fleet roster', () => {
  let store: GameStore;
  let fixture: ComponentFixture<DeployPanel>;

  beforeEach(() => {
    store = setup();
    fixture = TestBed.createComponent(DeployPanel);
    fixture.detectChanges();
  });

  it('lists all four classes', () => {
    expect(buttons(fixture, '.slot')).toHaveLength(4);
  });

  it('spells out the deck count of every class — the size is readable without hovering', () => {
    const body = text(fixture);
    expect(body).toContain('4 decks');
    expect(body).toContain('3 decks');
    expect(body).toContain('2 decks');
    expect(body).toContain('1 deck');
  });

  it('shows how many of a class are still to be placed', () => {
    expect(text(fixture)).toContain('Battleship');
    expect(text(fixture)).toMatch(/1\s*\/\s*1/);
  });

  it('clicking a class picks that calibre', () => {
    buttons(fixture, '.slot')[2].click(); // destroyer
    expect(store.pickedSize()).toBe(2);
  });

  it('a class with nothing left to place is disabled', () => {
    store.autoPlace();
    fixture.detectChanges();
    expect(buttons(fixture, '.slot').every((b) => b.disabled)).toBe(true);
  });

  it('the picked class is highlighted', () => {
    buttons(fixture, '.slot')[1].click();
    fixture.detectChanges();
    expect(buttons(fixture, '.slot')[1].classList).toContain('picked');
  });

  it('announces the pick to a screen reader, not by colour alone', () => {
    buttons(fixture, '.slot')[1].click();
    fixture.detectChanges();

    const slots = buttons(fixture, '.slot');
    expect(slots[1].getAttribute('aria-pressed')).toBe('true');
    expect(slots.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
  });

  it('the rotate button names the orientation it is currently in', () => {
    expect(text(fixture)).toContain('Horizontal');
    store.rotate();
    fixture.detectChanges();
    expect(text(fixture)).toContain('Vertical');
  });

  it('drawing lots deploys the whole fleet', () => {
    const roll = buttons(fixture, '.btn').find((b) => b.textContent?.includes('Draw lots'))!;
    roll.click();
    expect(store.player().ships).toHaveLength(FLEET_SHIPS);
  });

  it('clearing takes the fleet back off the chart', () => {
    store.autoPlace();
    fixture.detectChanges();
    buttons(fixture, '.btn')
      .find((b) => b.textContent?.includes('Clear'))!
      .click();
    expect(store.player().ships).toHaveLength(0);
  });

  it('while the fleet is short the button counts the rest instead of calling to battle', () => {
    const launch = buttons(fixture, '.launch')[0];
    expect(launch.disabled).toBe(true);
    expect(launch.textContent).toContain('10 ships left to place');
  });

  it('a complete fleet unlocks the battle button', () => {
    store.autoPlace();
    fixture.detectChanges();
    const launch = buttons(fixture, '.launch')[0];
    expect(launch.disabled).toBe(false);
    expect(launch.textContent).toContain('To battle');
    launch.click();
    expect(store.phase()).toBe('battle');
  });

  it('the opponent level is chosen by a click', () => {
    const levels = buttons(fixture, '.level');
    expect(levels).toHaveLength(3);
    levels[2].click();
    expect(store.difficulty()).toBe('admiral');
  });
});

describe('report and firing log', () => {
  let store: GameStore;
  let fixture: ComponentFixture<BattlePanel>;

  beforeEach(() => {
    vi.useFakeTimers();
    store = setup(31);
    store.autoPlace();
    store.beginBattle();
    fixture = TestBed.createComponent(BattlePanel);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows both fleets as pennants', () => {
    const pips = (fixture.nativeElement as HTMLElement).querySelectorAll('.pip');
    expect(pips).toHaveLength(FLEET_SHIPS * 2);
  });

  it('keeps the enemy ships veiled until they go down', () => {
    const veiled = (fixture.nativeElement as HTMLElement).querySelectorAll('.pip.veiled');
    expect(veiled).toHaveLength(FLEET_SHIPS);
  });

  it('before the first salvo the log invites a shot instead of standing empty', () => {
    expect(text(fixture)).toContain('Not one salvo yet');
  });

  it('a salvo puts a line in the log naming the square it went to', () => {
    const target = store.enemy().ships[0].cells[0];
    store.fireAt(target);
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();

    const entries = (fixture.nativeElement as HTMLElement).querySelectorAll('.log li');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].textContent).toMatch(/[A-J](?:10|[1-9])/);
    expect(entries[0].textContent).toContain(coord(target, 'en'));
  });

  it('a sinking is written out in the log in words, and the class is named', () => {
    const boat = store.enemy().ships.find((s) => s.size === 1)!;
    store.fireAt(boat.cells[0]);
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(text(fixture)).toContain('Patrol boat sunk');
  });

  it('counts the salvos and the accuracy', () => {
    store.fireAt(store.enemy().ships[0].cells[0]);
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(text(fixture)).toContain('100%');
  });

  it('names the level the opponent is playing at', () => {
    expect(text(fixture)).toContain('Midshipman');
  });
});

describe('the result card', () => {
  let store: GameStore;

  const finish = (): ComponentFixture<ResultOverlay> => {
    const fixture = TestBed.createComponent(ResultOverlay);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    store = setup(3);
    store.autoPlace();
    store.beginBattle();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('declares the victory and adds the battle up', () => {
    for (const cell of store.enemy().ships.flatMap((s) => s.cells)) {
      store.fireAt(cell);
      vi.advanceTimersByTime(1000);
    }
    vi.advanceTimersByTime(5000);

    const fixture = finish();
    const body = text(fixture);
    expect(body).toMatch(/Victory/i);

    // the VALUES are checked against the store: "Accuracy"/"Sunk" are static
    // captions, they cannot fail and therefore hold nothing down
    const values = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.figures dd'),
    ).map((dd) => dd.textContent?.trim() ?? '');

    expect(values[0]).toBe(String(store.playerStats().shots));
    expect(values[1]).toBe(`${store.playerStats().accuracy}%`);
    expect(values[2]).toContain(String(store.enemyLosses()));
    expect(store.enemyLosses()).toBe(10);
  });

  it('declares the defeat and counts what was lost', () => {
    // the player does nothing but miss — the opponent calmly plays its own game out
    for (let n = 0; n < 400 && store.phase() === 'battle'; n++) {
      if (store.canFire()) {
        const miss = store
          .enemy()
          .shots.findIndex((s, i) => s === 'unknown' && store.enemy().shipAt[i] === -1);
        if (miss === -1) break;
        store.fireAt(miss);
      }
      vi.advanceTimersByTime(3000);
    }
    vi.advanceTimersByTime(5000);

    expect(store.winner()).toBe('enemy');
    const fixture = finish();
    expect(text(fixture)).toMatch(/Defeat/i);
    expect(store.playerLosses()).toBe(10);
  });

  it('"deploy again" hands back an empty chart', () => {
    for (const cell of store.enemy().ships.flatMap((s) => s.cells)) {
      store.fireAt(cell);
      vi.advanceTimersByTime(1000);
    }
    vi.advanceTimersByTime(5000);

    const fixture = finish();
    buttons(fixture, '.btn')
      .find((b) => b.textContent?.includes('Deploy again'))!
      .click();

    expect(store.phase()).toBe('deploy');
    expect(store.fleetReady()).toBe(false);
  });

  it('"another battle" opens a fresh game with the fleet already standing', () => {
    for (const cell of store.enemy().ships.flatMap((s) => s.cells)) {
      store.fireAt(cell);
      vi.advanceTimersByTime(1000);
    }
    vi.advanceTimersByTime(5000);

    const fixture = finish();
    buttons(fixture, '.btn')
      .find((b) => b.textContent?.includes('Another battle'))!
      .click();

    expect(store.phase()).toBe('deploy');
    expect(store.fleetReady()).toBe(true);
  });

  it('focus moves into the card — it is declared modal', () => {
    for (const cell of store.enemy().ships.flatMap((s) => s.cells)) {
      store.fireAt(cell);
      vi.advanceTimersByTime(1000);
    }
    vi.advanceTimersByTime(5000);

    const fixture = finish();
    const card = (fixture.nativeElement as HTMLElement).querySelector('.cartouche');
    expect(document.activeElement).toBe(card);
  });

  it('Escape dismisses the card', () => {
    for (const cell of store.enemy().ships.flatMap((s) => s.cells)) {
      store.fireAt(cell);
      vi.advanceTimersByTime(1000);
    }
    vi.advanceTimersByTime(5000);
    finish();

    expect(store.verdictOpen()).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(store.verdictOpen()).toBe(false);
  });

  it('"survey the square" puts the card away without starting a new game', () => {
    for (const cell of store.enemy().ships.flatMap((s) => s.cells)) {
      store.fireAt(cell);
      vi.advanceTimersByTime(1000);
    }
    vi.advanceTimersByTime(5000);

    const fixture = finish();
    buttons(fixture, '.survey')[0].click();

    expect(store.verdictOpen()).toBe(false);
    expect(store.phase()).toBe('over');
  });
});

describe('the panels speak whichever language is chosen', () => {
  let store: GameStore;
  let i18n: I18n;

  beforeEach(() => {
    vi.useFakeTimers();
    store = setup(31);
    i18n = TestBed.inject(I18n);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('redraws the deployment panel in Russian — no label is left behind in English', () => {
    store.autoPlace();
    const fixture = TestBed.createComponent(DeployPanel);
    fixture.detectChanges();
    expect(text(fixture)).toContain('Battleship');

    i18n.setLang('ru');
    fixture.detectChanges();

    expect(text(fixture)).toContain('Линкор');
    expect(text(fixture)).not.toContain('Battleship');
    expect(buttons(fixture, '.launch')[0].textContent).toContain('К бою');
  });

  it('names the ships in Hebrew from its own dictionary, not from an English fallback', () => {
    const fixture = TestBed.createComponent(DeployPanel);
    fixture.detectChanges();

    i18n.setLang('he');
    fixture.detectChanges();

    expect(text(fixture)).toContain('ספינת קרב');
    expect(text(fixture)).not.toContain('Battleship');
  });

  it('re-reads a log line already written — it kept a square and a size, not a sentence', () => {
    store.autoPlace();
    store.beginBattle();
    const fixture = TestBed.createComponent(BattlePanel);
    fixture.detectChanges();

    const boat = store.enemy().ships.find((s) => s.size === 1)!;
    store.fireAt(boat.cells[0]);
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();

    const line = (): string =>
      (fixture.nativeElement as HTMLElement).querySelector('.log li')?.textContent ?? '';

    expect(line()).toContain(coord(boat.cells[0], 'en'));
    expect(line()).toContain('Patrol boat sunk');

    i18n.setLang('ru');
    fixture.detectChanges();

    expect(line()).toContain(coord(boat.cells[0], 'ru'));
    expect(line()).toContain('Катер потоплен');
  });
});
