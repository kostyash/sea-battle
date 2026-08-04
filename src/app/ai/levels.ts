/**
 * The opponent's levels.
 *
 * Only the identity of a level lives here. Its name and its one-line
 * description are words, so they live in the dictionaries under
 * `level.<id>.name` and `level.<id>.hint`.
 */

export type Difficulty = 'cabin-boy' | 'midshipman' | 'admiral';

export const DIFFICULTIES: readonly Difficulty[] = ['cabin-boy', 'midshipman', 'admiral'];

/** The translation keys a level answers to. */
export const levelNameKey = (id: Difficulty) => `level.${id}.name` as const;
export const levelHintKey = (id: Difficulty) => `level.${id}.hint` as const;
