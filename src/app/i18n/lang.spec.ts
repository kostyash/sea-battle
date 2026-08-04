import { describe, expect, it } from 'vitest';
import { CELLS, SIZE, colOf, idx, rowOf } from '../domain/grid';
import { COL_LABELS, DEFAULT_LANG, LANGS, ROW_LABELS, dirOf, isLang } from './lang';

const everyCell = Array.from({ length: CELLS }, (_, i) => i);
const langs = LANGS.map((l) => l.id);

/** How a square is spelled out loud in a given language — row letter, then column digit. */
const label = (lang: (typeof langs)[number], cell: number): string =>
  `${ROW_LABELS[lang][rowOf(cell)]}${COL_LABELS[colOf(cell)]}`;

describe('the languages the game speaks', () => {
  it('opens in English — the language the game is written in', () => {
    expect(DEFAULT_LANG).toBe('en');
    expect(langs).toContain(DEFAULT_LANG);
  });

  it('gives every language a button label and a name of its own', () => {
    for (const l of LANGS) {
      expect(l.label.length).toBeGreaterThan(0);
      expect(l.name.length).toBeGreaterThan(0);
    }
  });
});

describe('row labels', () => {
  it('every language labels exactly as many rows as the square has', () => {
    for (const lang of langs) expect(ROW_LABELS[lang]).toHaveLength(SIZE);
  });

  it('no language spells one letter twice — ten rows, ten different letters', () => {
    for (const lang of langs) expect(new Set(ROW_LABELS[lang]).size).toBe(SIZE);
  });

  it('English rows run A to J', () => {
    expect([...ROW_LABELS.en]).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
  });

  it('Russian rows follow the paper score sheet — no Ё and no Й', () => {
    expect([...ROW_LABELS.ru]).toEqual(['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К']);
    expect(ROW_LABELS.ru).not.toContain('Ё');
    expect(ROW_LABELS.ru).not.toContain('Й');
  });

  it('Hebrew rows are the first ten letters of its own alphabet', () => {
    expect([...ROW_LABELS.he]).toEqual(['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י']);
  });
});

describe('column labels', () => {
  it('columns are digits one to ten, in every language alike', () => {
    expect([...COL_LABELS]).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    expect(COL_LABELS).toHaveLength(SIZE);
  });
});

describe('spelling a square out loud', () => {
  it('names the corners and the middle the way a player calls them', () => {
    expect(label('en', idx(0, 0))).toBe('A1');
    expect(label('en', idx(0, 9))).toBe('A10');
    expect(label('en', idx(1, 3))).toBe('B4');
    expect(label('en', idx(9, 0))).toBe('J1');
    expect(label('en', idx(9, 9))).toBe('J10');
    expect(label('ru', idx(1, 3))).toBe('Б4');
    expect(label('ru', idx(9, 9))).toBe('К10');
    expect(label('he', idx(1, 3))).toBe('ב4');
  });

  it('gives all hundred squares a name of their own in every language', () => {
    for (const lang of langs) {
      expect(new Set(everyCell.map((cell) => label(lang, cell))).size).toBe(CELLS);
    }
  });
});

describe('isLang', () => {
  it('recognises every language the game speaks', () => {
    for (const lang of langs) expect(isLang(lang)).toBe(true);
  });

  it('turns away anything else, junk that is not even a string included', () => {
    expect(isLang('de')).toBe(false);
    expect(isLang('EN')).toBe(false);
    expect(isLang('')).toBe(false);
    expect(isLang(null)).toBe(false);
    expect(isLang(undefined)).toBe(false);
    expect(isLang(42)).toBe(false);
    expect(isLang({ id: 'en' })).toBe(false);
  });
});

describe('dirOf', () => {
  it('Hebrew is the one language that reads right to left', () => {
    expect(dirOf('he')).toBe('rtl');
    expect(dirOf('en')).toBe('ltr');
    expect(dirOf('ru')).toBe('ltr');
  });

  it('answers with the direction each language declares for itself', () => {
    for (const l of LANGS) expect(dirOf(l.id)).toBe(l.dir);
  });
});
