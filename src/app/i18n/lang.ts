/** The languages the game speaks, and the coordinate letters each one uses. */

export type Lang = 'en' | 'ru' | 'he';

export type Direction = 'ltr' | 'rtl';

export interface LangInfo {
  id: Lang;
  /** What goes on the switch button — always in the language itself. */
  label: string;
  /** The language's own name, for the button's accessible name. */
  name: string;
  dir: Direction;
}

export const LANGS: readonly LangInfo[] = [
  { id: 'en', label: 'EN', name: 'English', dir: 'ltr' },
  { id: 'ru', label: 'РУ', name: 'Русский', dir: 'ltr' },
  { id: 'he', label: 'עב', name: 'עברית', dir: 'rtl' },
];

export const DEFAULT_LANG: Lang = 'en';

/**
 * Row letters, one alphabet per language. Kept here rather than in the domain:
 * a cell is a number everywhere in the rules, and only the display of that
 * number has a language.
 *
 * Russian skips Ё and Й, as a paper score sheet does. Hebrew uses the first ten
 * letters of its own alphabet.
 */
export const ROW_LABELS: Record<Lang, readonly string[]> = {
  en: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  ru: ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'],
  he: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י'],
};

/** Columns are digits in every language, Hebrew included. */
export const COL_LABELS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export function isLang(value: unknown): value is Lang {
  return LANGS.some((l) => l.id === value);
}

export function dirOf(lang: Lang): Direction {
  return LANGS.find((l) => l.id === lang)!.dir;
}
