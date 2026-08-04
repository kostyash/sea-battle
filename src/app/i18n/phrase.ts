/**
 * The shape of a translated phrase.
 *
 * A phrase is usually one string. When the wording depends on a count, it is a
 * set of forms instead, keyed by the categories `Intl.PluralRules` returns for
 * the language: English needs `one`/`other`, Russian also `few` and `many`,
 * Hebrew also `two`. Only `other` is mandatory — it is the fallback when a
 * language asks for a category this phrase does not spell out.
 */
export interface PluralForms {
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export type Phrase = string | PluralForms;

/**
 * Values a phrase can interpolate. Placeholders are written `{n}`, `{ship}`,
 * `{ship_lc}`, `{coord}` and `{text}`.
 *
 * `size` and `cell` are deliberately raw game data rather than ready strings:
 * a ship class and a coordinate are themselves language-dependent, so they must
 * be rendered at the moment of display and not when the message is produced.
 */
export interface Params {
  /** A count. Selects the plural form and fills `{n}`. */
  n?: number;
  /** Ship length 1…4. Fills `{ship}` and, lower-cased, `{ship_lc}`. */
  size?: number;
  /** Cell index 0…99. Fills `{coord}` with its label in the active language. */
  cell?: number;
  /** An already-translated fragment. Fills `{text}`. */
  text?: string;
}

/**
 * A message stored rather than displayed: the key and its data, not the words.
 *
 * The store keeps these instead of finished sentences, so that switching the
 * language mid-game re-renders the status line and the log in the new one
 * instead of leaving the last move stranded in the old.
 */
export interface Msg<K extends string = string> {
  key: K;
  params?: Params;
}
