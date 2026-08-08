import { DOCUMENT, Service, computed, effect, inject, signal } from '@angular/core';
import { colOf, rowOf } from '../domain/grid';
import { COL_LABELS, DEFAULT_LANG, Lang, ROW_LABELS, dirOf, isLang } from './lang';
import { EN, MsgKey } from './en';
import { RU } from './ru';
import { HE } from './he';
import { Msg, Params, Phrase, PluralForms } from './phrase';

const DICTIONARIES: Record<Lang, Record<MsgKey, Phrase>> = { en: EN, ru: RU, he: HE };

const STORAGE_KEY = 'sb.lang';

/**
 * The chosen language has to survive a reload, but storage can be unreachable:
 * inside `sandbox="allow-scripts"`, or with site data blocked, touching it
 * throws SecurityError. Language is not a reason for the game to refuse to
 * open, so a refusal is swallowed — exactly as the sound settings do.
 */
function readStored(): Lang | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isLang(saved) ? saved : null;
  } catch {
    return null;
  }
}

function remember(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // the choice will not survive a reload — not a reason to break the game
  }
}

/**
 * The first language we speak out of the ones asked for. `ru-RU` and `he-IL`
 * count as Russian and Hebrew; anything else falls back to English, the language
 * the game is written in.
 *
 * Takes the list rather than reading `navigator` itself so that the choice can
 * be exercised without pretending to be a browser — and so the prerender, which
 * has no `navigator` at all, is just the empty-list case.
 */
export function preferredLang(asked: readonly string[]): Lang {
  for (const tag of asked) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLang(base)) return base;
  }
  return DEFAULT_LANG;
}

/**
 * What this browser asks for, if there is a browser to ask.
 *
 * Two ways there is nothing to read: the prerender runs in Node and has no
 * `navigator` at all, and an older Safari has one without `languages`. Neither
 * is a reason to fail — both simply mean nobody asked, and English answers.
 */
export function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages ?? [navigator.language];
}

@Service()
export class I18n {
  private readonly doc = inject(DOCUMENT);

  readonly lang = signal<Lang>(readStored() ?? preferredLang(browserLanguages()));

  readonly dir = computed(() => dirOf(this.lang()));
  readonly rtl = computed(() => this.dir() === 'rtl');

  /** Row letters of the active language — the board gutter reads this. */
  readonly rowLabels = computed(() => ROW_LABELS[this.lang()]);
  readonly colLabels = COL_LABELS;

  constructor() {
    // The page itself has to declare its language and direction: `dir` is what
    // drives every logical CSS property, and `lang` is what a screen reader
    // picks a voice by.
    effect(() => {
      const root = this.doc.documentElement;
      root.setAttribute('lang', this.lang());
      root.setAttribute('dir', this.dir());
    });
  }

  setLang(lang: Lang): void {
    this.lang.set(lang);
    remember(lang);
  }

  /**
   * A phrase in the active language, with its placeholders filled.
   *
   * Reading `lang()` here is what makes every template that calls `t` re-render
   * on a language switch — no subscription, no pipe, no manual refresh.
   */
  t(key: MsgKey, params?: Params): string {
    const lang = this.lang();
    // No fallback to English here, and none is needed: `Dictionary` is
    // `Record<MsgKey, Phrase>`, so a language that misses a key does not compile.
    return this.fill(pick(DICTIONARIES[lang][key], lang, params?.n), params);
  }

  /** A ship class by its length: `4` → “Battleship”. */
  shipName(size: number): string {
    const key = `ship.${size}` as MsgKey;
    return key in EN ? this.t(key) : this.t('ship.any');
  }

  /** “B4” — how the player calls a square out loud, in their own alphabet. */
  coord(cell: number): string {
    return `${this.rowLabels()[rowOf(cell)]}${COL_LABELS[colOf(cell)]}`;
  }

  /** A message the store kept as data, turned into a sentence at last. */
  say(msg: Msg<MsgKey>): string {
    return this.t(msg.key, msg.params);
  }

  private fill(text: string, params?: Params): string {
    if (!params) return text;
    let out = text;
    if (params.n !== undefined) out = out.replaceAll('{n}', String(params.n));
    if (params.size !== undefined) {
      const name = this.shipName(params.size);
      out = out
        .replaceAll('{ship}', name)
        .replaceAll('{ship_lc}', name.toLocaleLowerCase(this.lang()));
    }
    if (params.cell !== undefined) out = out.replaceAll('{coord}', this.coord(params.cell));
    if (params.text !== undefined) out = out.replaceAll('{text}', params.text);
    return out;
  }
}

/**
 * One of a phrase's plural forms, chosen by the language's own rules.
 *
 * Each language asks for its own set of categories — English one/other, Russian
 * one/few/many/other, Hebrew one/two/other — and every phrase is required to
 * answer all of the ones its language can produce; `dictionaries.spec.ts` holds
 * that. `other` is the fallback for a category left unspelled, and the one form
 * every phrase must have, so a count is never shown with no wording at all.
 */
function pick(phrase: Phrase, lang: Lang, n?: number): string {
  if (typeof phrase === 'string') return phrase;
  if (n === undefined) return phrase.other;
  const form = new Intl.PluralRules(lang).select(n) as keyof PluralForms;
  return phrase[form] ?? phrase.other;
}
