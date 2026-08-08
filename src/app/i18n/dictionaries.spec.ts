import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, levelHintKey, levelNameKey } from '../ai/levels';
import { EN, MsgKey } from './en';
import { HE } from './he';
import { Lang } from './lang';
import { Phrase, PluralForms } from './phrase';
import { RU } from './ru';

type Book = Record<MsgKey, Phrase>;

const TRANSLATIONS: readonly (readonly [Lang, Book])[] = [
  ['ru', RU],
  ['he', HE],
];

const ALL: readonly (readonly [Lang, Book])[] = [['en', EN], ...TRANSLATIONS];

/** The categories `Intl.PluralRules` can hand back for the three languages. */
const PLURAL_FORMS = ['one', 'two', 'few', 'many', 'other'] as const;

/**
 * The data a placeholder makes the caller pass. `{ship}` and `{ship_lc}` are the
 * one and the same datum — a ship size — which is why the check below is stated
 * over data and not over the tokens themselves: Russian puts the capitalised
 * class name at the head of a sentence where English carries it in the middle,
 * and Hebrew has no case at all. Comparing tokens would call that a fault.
 */
const NEEDED: Readonly<Record<string, string>> = {
  '{n}': 'a count',
  '{ship}': 'a ship size',
  '{ship_lc}': 'a ship size',
  '{coord}': 'a square',
  '{text}': 'a ready fragment',
};

const PLACEHOLDER = /\{[a-z_]+\}/gi;

/** A phrase spread out into the strings it is actually made of. */
const wordings = (phrase: Phrase): Record<string, string> => {
  if (typeof phrase === 'string') return { other: phrase };
  const out: Record<string, string> = {};
  for (const [form, wording] of Object.entries(phrase)) {
    if (typeof wording === 'string') out[form] = wording;
  }
  return out;
};

const needs = (phrase: Phrase): Set<string> => {
  const found = new Set<string>();
  for (const wording of Object.values(wordings(phrase))) {
    for (const [token, datum] of Object.entries(NEEDED)) {
      if (wording.includes(token)) found.add(datum);
    }
  }
  return found;
};

/** Does the phrase carry any words of its own, or is it punctuation round holes? */
const hasWords = (wording: string): boolean => /\p{L}/u.test(wording.replaceAll(PLACEHOLDER, ''));

const keys = Object.keys(EN) as MsgKey[];

describe('the dictionaries answer one and the same contract', () => {
  it.each(TRANSLATIONS)(
    '%s answers exactly the keys English defines — no gap, no extra',
    (_, book) => {
      expect(Object.keys(book).sort()).toEqual(keys.map(String).sort());
    },
  );

  it.each(ALL)('%s leaves no phrase empty', (_, book) => {
    for (const key of keys) {
      for (const [form, wording] of Object.entries(wordings(book[key]))) {
        expect(wording.trim(), `${key} / ${form}`).not.toBe('');
      }
    }
  });
});

describe('a translation asks for exactly the data the English original does', () => {
  /**
   * Both directions, and the second is the one that bites. Asking for data the
   * caller never passes leaves a raw `{coord}` on screen; *dropping* one is
   * quieter and worse — the sentence still reads, it has simply stopped saying
   * which square was hit. `msg.yourShipHit` is the shortest way to that bug.
   */
  it.each(TRANSLATIONS)('%s asks for the same data, no more and no less', (lang, book) => {
    for (const key of keys) {
      const english = [...needs(EN[key])].sort();
      const translated = [...needs(book[key])].sort();
      expect(translated, `${key} in ${lang} does not ask for what English does`).toEqual(english);
    }
  });

  it.each(ALL)('%s uses no placeholder the layer would not know how to fill', (_, book) => {
    for (const key of keys) {
      for (const wording of Object.values(wordings(book[key]))) {
        for (const token of wording.match(PLACEHOLDER) ?? []) {
          expect(Object.keys(NEEDED), `${key} carries ${token}`).toContain(token);
        }
      }
    }
  });
});

describe('nothing was left in English by accident', () => {
  /**
   * A phrase made of nothing but placeholders and punctuation — `{coord} — {text}`
   * — is the same in every language on purpose, so only phrases carrying words of
   * their own are held to this.
   */
  it.each(TRANSLATIONS)('%s repeats no English wording that has words in it', (_, book) => {
    for (const key of keys) {
      const english = wordings(EN[key]);
      const translated = wordings(book[key]);
      for (const [form, wording] of Object.entries(english)) {
        if (!hasWords(wording) || translated[form] === undefined) continue;
        expect(translated[form], `${key} / ${form} is still in English`).not.toBe(wording);
      }
    }
  });
});

describe('phrases that vary with a count', () => {
  it.each(ALL)(
    '%s gives every counted phrase the `other` form the rules fall back to',
    (_, book) => {
      for (const key of keys) {
        const phrase = book[key];
        if (typeof phrase === 'string') continue;
        expect(typeof phrase.other, `${key} has no other form`).toBe('string');
        expect(phrase.other.length, key).toBeGreaterThan(0);
      }
    },
  );

  it.each(ALL)('%s spells its forms with the names the plural rules use', (_, book) => {
    for (const key of keys) {
      const phrase = book[key];
      if (typeof phrase === 'string') continue;
      for (const form of Object.keys(phrase)) {
        expect(PLURAL_FORMS as readonly string[], `${key} / ${form}`).toContain(form);
      }
    }
  });

  /**
   * `pick` falls back to `other` when a language asks for a category the phrase
   * has not spelled out — and this is what keeps that fallback from ever being
   * needed. It is worth stating because the categories are not obvious: modern
   * CLDR gives Hebrew one/two/other and no `many` at all, while Russian really
   * does need four. Guessing wrong shows up as a count in the wrong wording.
   */
  it.each(ALL)('%s answers every plural category its own language can ask for', (lang, book) => {
    const categories = new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
    for (const category of categories) {
      // `PluralForms` has to have a slot for it at all — none of the three uses
      // `zero`, and if one ever did, no phrase could spell it out.
      expect(PLURAL_FORMS as readonly string[], `${lang} asks for ${category}`).toContain(category);
    }
    for (const key of keys) {
      const phrase = book[key];
      if (typeof phrase === 'string') continue;
      for (const category of categories as readonly (keyof PluralForms)[]) {
        expect(typeof phrase[category], `${key} has no ${category} form`).toBe('string');
      }
    }
  });
});

describe('the opponent levels are named in the dictionaries', () => {
  it.each(ALL)('%s names and describes every level a difficulty can build a key for', (_, book) => {
    for (const id of DIFFICULTIES) {
      for (const key of [levelNameKey(id), levelHintKey(id)]) {
        const phrase = book[key as MsgKey];
        expect(typeof phrase, `${key} is missing`).toBe('string');
        expect((phrase as string).length, key).toBeGreaterThan(0);
      }
    }
  });
});
