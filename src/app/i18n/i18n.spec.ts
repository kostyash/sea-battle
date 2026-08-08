import { TestBed } from '@angular/core/testing';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CELLS, colOf, idx, rowOf } from '../domain/grid';
import { COL_LABELS, ROW_LABELS } from './lang';
import { I18n, browserLanguages, preferredLang } from './i18n';

const service = (): I18n => {
  TestBed.configureTestingModule({});
  return TestBed.inject(I18n);
};

/** The service plus the tick that lets its effect reach the page, as in the app. */
const onPage = (): I18n => {
  const i18n = service();
  TestBed.tick();
  return i18n;
};

const root = document.documentElement;
const langBefore = root.getAttribute('lang');
const dirBefore = root.getAttribute('dir');

const deny = (method: 'getItem' | 'setItem'): void => {
  vi.spyOn(Storage.prototype, method).mockImplementation(() => {
    throw new DOMException('Denied', 'SecurityError');
  });
};

describe('I18n', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    // Poisoned on purpose: an assertion below must pass because the effect wrote
    // the attribute, not because a previous test happened to leave it right.
    root.setAttribute('lang', 'xx');
    root.setAttribute('dir', 'rtl');
  });

  afterEach(() => {
    // The Storage.prototype stub is global, and so is <html>: both have to be put
    // back unconditionally, not at the end of a test that may never reach its end.
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  afterAll(() => {
    if (langBefore === null) root.removeAttribute('lang');
    else root.setAttribute('lang', langBefore);
    if (dirBefore === null) root.removeAttribute('dir');
    else root.setAttribute('dir', dirBefore);
  });

  describe('the language now on', () => {
    it('opens in English — the language the game is written in', () => {
      expect(service().lang()).toBe('en');
    });

    it('says the same phrase in whichever language is on', () => {
      const i18n = service();

      expect(i18n.t('app.title')).toBe('Sea Battle');
      i18n.setLang('ru');
      expect(i18n.t('app.title')).toBe('Морской бой');
      i18n.setLang('he');
      expect(i18n.t('app.title')).toBe('קרב ימי');
      i18n.setLang('en');
      expect(i18n.t('app.title')).toBe('Sea Battle');
    });

    it('hands the board the row letters of the language now on', () => {
      const i18n = service();

      expect(i18n.rowLabels()[0]).toBe('A');
      i18n.setLang('ru');
      expect(i18n.rowLabels()[0]).toBe('А');
      i18n.setLang('he');
      expect(i18n.rowLabels()[0]).toBe('א');
    });

    it('numbers the columns the same way in every language', () => {
      const i18n = service();

      expect([...i18n.colLabels]).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    });

    it('Hebrew is the one language that turns the page round', () => {
      const i18n = service();

      expect(i18n.dir()).toBe('ltr');
      expect(i18n.rtl()).toBe(false);
      i18n.setLang('he');
      expect(i18n.dir()).toBe('rtl');
      expect(i18n.rtl()).toBe(true);
      i18n.setLang('ru');
      expect(i18n.dir()).toBe('ltr');
      expect(i18n.rtl()).toBe(false);
    });
  });

  describe('filling a phrase in', () => {
    it('a phrase without placeholders comes back word for word', () => {
      expect(service().t('msg.hit')).toBe('A hit! Fire again.');
    });

    it('data the phrase does not ask for changes nothing', () => {
      expect(service().t('msg.hit', { cell: 0, size: 4, text: 'nonsense' })).toBe(
        'A hit! Fire again.',
      );
    });

    it('{n} is filled with the count itself', () => {
      expect(service().t('sea.away.progress', { n: 7 })).toBe('7 of 10 charted');
    });

    it('{coord} is spelled in the alphabet of the language now on', () => {
      const i18n = service();
      const cell = idx(1, 3);

      expect(i18n.t('msg.enemyMiss', { cell })).toBe(
        'The opponent fires at B4 — a miss. Your move.',
      );
      i18n.setLang('ru');
      expect(i18n.t('msg.enemyMiss', { cell })).toBe('Противник бьёт в Б4 — мимо. Ваш ход.');
      i18n.setLang('he');
      expect(i18n.t('msg.enemyMiss', { cell })).toBe('היריב יורה אל ב4 — החטאה. תורך.');
    });

    it('{ship} is the class the size stands for, {ship_lc} the same name in lower case', () => {
      const i18n = service();

      expect(i18n.t('msg.shipRemoved', { size: 4 })).toBe('Battleship taken off the chart');
      expect(i18n.t('msg.allPlaced', { size: 4 })).toBe('Every battleship is already on the chart');
    });

    it('a placeholder repeated in a phrase is filled everywhere, not just the first time', () => {
      const i18n = service();

      expect(i18n.t('cell.label', { cell: idx(0, 0), text: i18n.t('cell.miss') })).toBe(
        'A1 — miss',
      );
    });
  });

  describe('spelling a square out loud', () => {
    it('names the first and the last square in every language the game speaks', () => {
      const i18n = service();

      expect(i18n.coord(0)).toBe('A1');
      expect(i18n.coord(99)).toBe('J10');
      i18n.setLang('ru');
      expect(i18n.coord(0)).toBe('А1');
      expect(i18n.coord(99)).toBe('К10');
      i18n.setLang('he');
      expect(i18n.coord(0)).toBe('א1');
      expect(i18n.coord(99)).toBe('י10');
    });

    /**
     * All hundred squares, through the function that actually ships, in each
     * language — not through a copy of it spelled out in the spec. A pair of
     * cells sharing a name is the failure that matters: two squares the player
     * cannot tell apart when calling the shot.
     */
    it('gives all hundred squares a name of their own, in each language', () => {
      const i18n = service();

      for (const lang of ['en', 'ru', 'he'] as const) {
        i18n.setLang(lang);
        const names = Array.from({ length: CELLS }, (_, cell) => i18n.coord(cell));
        expect(new Set(names).size, `${lang} repeats a square name`).toBe(CELLS);
        for (const cell of [0, 9, 10, 42, 90, 99]) {
          expect(names[cell], `${lang} cell ${cell}`).toBe(
            `${ROW_LABELS[lang][rowOf(cell)]}${COL_LABELS[colOf(cell)]}`,
          );
        }
      }
    });
  });

  describe('naming a ship by its length', () => {
    it('every class of the fleet has a name of its own in English', () => {
      const i18n = service();

      expect(i18n.shipName(1)).toBe('Patrol boat');
      expect(i18n.shipName(2)).toBe('Destroyer');
      expect(i18n.shipName(3)).toBe('Cruiser');
      expect(i18n.shipName(4)).toBe('Battleship');
    });

    it('and a name of its own in every other language too', () => {
      const i18n = service();

      i18n.setLang('ru');
      expect([1, 2, 3, 4].map((n) => i18n.shipName(n))).toEqual([
        'Катер',
        'Эсминец',
        'Крейсер',
        'Линкор',
      ]);
      i18n.setLang('he');
      expect([1, 2, 3, 4].map((n) => i18n.shipName(n))).toEqual([
        'סירת סיור',
        'משחתת',
        'סיירת',
        'ספינת קרב',
      ]);
    });

    it('a length no class answers to falls back to the generic word', () => {
      const i18n = service();

      expect(i18n.shipName(5)).toBe('Ship');
      expect(i18n.shipName(0)).toBe('Ship');
      i18n.setLang('ru');
      expect(i18n.shipName(9)).toBe('Корабль');
      i18n.setLang('he');
      expect(i18n.shipName(9)).toBe('ספינה');
    });
  });

  describe('counting in three languages', () => {
    it('English tells one from the rest', () => {
      const i18n = service();

      expect(i18n.t('fleet.decks', { n: 1 })).toBe('1 deck');
      expect(i18n.t('fleet.decks', { n: 2 })).toBe('2 decks');
      expect(i18n.t('fleet.decks', { n: 5 })).toBe('5 decks');
      expect(i18n.t('deploy.remaining', { n: 1 })).toBe('1 ship left to place');
      expect(i18n.t('deploy.remaining', { n: 4 })).toBe('4 ships left to place');
    });

    it('Russian keeps all three of its forms apart — 1, 2 and 5 decks read differently', () => {
      const i18n = service();
      i18n.setLang('ru');

      expect(i18n.t('fleet.decks', { n: 1 })).toBe('1 палуба');
      expect(i18n.t('fleet.decks', { n: 2 })).toBe('2 палубы');
      expect(i18n.t('fleet.decks', { n: 5 })).toBe('5 палуб');
      expect(i18n.t('deploy.remaining', { n: 1 })).toBe('Осталось поставить 1 корабль');
      expect(i18n.t('deploy.remaining', { n: 3 })).toBe('Осталось поставить 3 корабля');
      expect(i18n.t('deploy.remaining', { n: 10 })).toBe('Осталось поставить 10 кораблей');
    });

    it('Hebrew has a form of its own for a pair', () => {
      const i18n = service();
      i18n.setLang('he');

      // The dual shows itself where the wording is a sentence. `fleet.decks` is a
      // data readout and keeps its digits in every form, so it is the singular
      // noun, not the numeral, that changes there.
      expect(i18n.t('deploy.remaining', { n: 1 })).toBe('נותרה להצבה ספינה אחת');
      expect(i18n.t('deploy.remaining', { n: 2 })).toBe('נותרו להצבה שתי ספינות');
      expect(i18n.t('deploy.remaining', { n: 7 })).toBe('נותרו להצבה 7 ספינות');
      expect(i18n.t('fleet.decks', { n: 1 })).toBe('1 סיפון');
      expect(i18n.t('fleet.decks', { n: 2 })).toBe('2 סיפונים');
    });

    it('the whole run of a real game is counted correctly — twenty decks down to one', () => {
      const i18n = service();
      i18n.setLang('he');

      // Twenty decks is the opening screen of a battle and one is the last gasp;
      // Hebrew asks for `other` at twenty and `one` at one.
      expect(i18n.t('battle.decksAfloat', { n: 20 })).toBe('סיפונים צפים');
      expect(i18n.t('battle.decksAfloat', { n: 2 })).toBe('סיפונים צפים');
      expect(i18n.t('battle.decksAfloat', { n: 1 })).toBe('סיפון צף');
    });

    it('with no count to go by a counted phrase falls back to its `other` form', () => {
      const i18n = service();

      expect(i18n.t('battle.decksAfloat')).toBe('decks afloat');
      i18n.setLang('ru');
      expect(i18n.t('battle.decksAfloat')).toBe('палубы на плаву');
    });
  });

  describe('a message kept as data until it is shown', () => {
    it('turns a stored key and its data into a sentence', () => {
      const i18n = service();

      expect(i18n.say({ key: 'msg.hit' })).toBe('A hit! Fire again.');
      expect(i18n.say({ key: 'fleet.decks', params: { n: 3 } })).toBe('3 decks');
    });

    it('renders a message carrying both a square and a ship size', () => {
      const i18n = service();
      const msg = { key: 'msg.yourShipSunk', params: { cell: idx(1, 3), size: 3 } } as const;

      expect(i18n.say(msg)).toBe('B4 — your cruiser is sunk');
    });

    it('the very same stored message reads in the new language after a switch', () => {
      const i18n = service();
      const msg = { key: 'msg.yourShipSunk', params: { cell: idx(1, 3), size: 3 } } as const;

      expect(i18n.say(msg)).toBe('B4 — your cruiser is sunk');
      i18n.setLang('ru');
      expect(i18n.say(msg)).toBe('Б4 — ваш крейсер потоплен');
      i18n.setLang('he');
      expect(i18n.say(msg)).toBe('ב4 — סיירת משלך הוטבעה');
    });
  });

  describe('the choice survives a reload', () => {
    it('a switch is written to the storage', () => {
      service().setLang('he');

      expect(localStorage.getItem('sb.lang')).toBe('he');
    });

    it('a service starting afresh opens in the language chosen last time', () => {
      service().setLang('ru');

      TestBed.resetTestingModule();
      const next = service();

      expect(next.lang()).toBe('ru');
      expect(next.t('app.title')).toBe('Морской бой');
    });

    it('junk in the storage is ignored rather than believed', () => {
      localStorage.setItem('sb.lang', 'klingon');

      expect(service().lang()).toBe('en');
    });
  });

  describe('storage that refuses to answer', () => {
    it('a ban on reading does not stop the service from being created', () => {
      deny('getItem');

      let i18n: I18n | null = null;
      expect(() => (i18n = service())).not.toThrow();
      expect(i18n!.lang()).toBe('en');
      expect(i18n!.t('app.title')).toBe('Sea Battle');
    });

    it('a ban on writing does not stop the language from being switched', () => {
      const i18n = service();
      deny('setItem');

      expect(() => i18n.setLang('he')).not.toThrow();
      expect(i18n.lang()).toBe('he');
      expect(i18n.t('app.title')).toBe('קרב ימי');
      expect(i18n.rtl()).toBe(true);
    });
  });

  describe('the page declares its own language', () => {
    it('writes the language now on and its direction onto the document', () => {
      onPage();

      expect(root.getAttribute('lang')).toBe('en');
      expect(root.getAttribute('dir')).toBe('ltr');
    });

    it('follows every switch, and turns the page round for Hebrew alone', () => {
      const i18n = onPage();

      i18n.setLang('ru');
      TestBed.tick();
      expect(root.getAttribute('lang')).toBe('ru');
      expect(root.getAttribute('dir')).toBe('ltr');

      i18n.setLang('he');
      TestBed.tick();
      expect(root.getAttribute('lang')).toBe('he');
      expect(root.getAttribute('dir')).toBe('rtl');

      i18n.setLang('en');
      TestBed.tick();
      expect(root.getAttribute('lang')).toBe('en');
      expect(root.getAttribute('dir')).toBe('ltr');
    });

    it('a remembered Hebrew leaves the page right to left from the very first frame', () => {
      localStorage.setItem('sb.lang', 'he');

      onPage();

      expect(root.getAttribute('lang')).toBe('he');
      expect(root.getAttribute('dir')).toBe('rtl');
    });
  });

  describe('the language a visitor is met in', () => {
    it('the first language we speak wins, whatever place it holds in the list', () => {
      expect(preferredLang(['he-IL', 'en-US'])).toBe('he');
      expect(preferredLang(['fr-FR', 'de', 'ru-RU'])).toBe('ru');
    });

    it('a region is only a region — ru-RU and ru are the same language', () => {
      expect(preferredLang(['RU-ru'])).toBe('ru');
      expect(preferredLang(['ru'])).toBe('ru');
    });

    it('a visitor we share no language with is met in English', () => {
      expect(preferredLang(['fr-FR', 'de-DE', 'ja'])).toBe('en');
    });

    it('nobody asked at all — the prerender has no navigator — and English still answers', () => {
      expect(preferredLang([])).toBe('en');
    });

    it('a browser that lists its languages is read from that list', () => {
      vi.stubGlobal('navigator', { languages: ['he-IL', 'en'], language: 'en-US' });

      expect(browserLanguages()).toEqual(['he-IL', 'en']);
    });

    it('an older browser offering only one language is read from that one', () => {
      vi.stubGlobal('navigator', { language: 'ru-RU' });

      expect(browserLanguages()).toEqual(['ru-RU']);
    });

    it('no navigator at all — as under the prerender — asks for nothing', () => {
      vi.stubGlobal('navigator', undefined);

      expect(browserLanguages()).toEqual([]);
    });
  });

  describe('the levels of the opponent are words like any other', () => {
    it('every level has a name and a hint in every language', () => {
      const i18n = service();

      expect(i18n.t('level.cabin-boy.name')).toBe('Cabin Boy');
      expect(i18n.t('level.midshipman.name')).toBe('Midshipman');
      expect(i18n.t('level.admiral.name')).toBe('Admiral');
      expect(i18n.t('level.admiral.hint')).toBe('Counts the odds across the whole board');

      i18n.setLang('ru');
      expect(i18n.t('level.cabin-boy.name')).toBe('Юнга');
      expect(i18n.t('level.midshipman.name')).toBe('Мичман');
      expect(i18n.t('level.admiral.name')).toBe('Адмирал');

      i18n.setLang('he');
      expect(i18n.t('level.cabin-boy.name')).toBe('נער סיפון');
      expect(i18n.t('level.midshipman.name')).toBe('צוער');
      expect(i18n.t('level.admiral.name')).toBe('אדמירל');
    });
  });
});
