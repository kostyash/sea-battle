/** Уровни противника. Название и подсказка живут рядом с самим уровнем. */

export type Difficulty = 'yunga' | 'michman' | 'admiral';

export interface DifficultyInfo {
  id: Difficulty;
  name: string;
  hint: string;
}

export const DIFFICULTIES: readonly DifficultyInfo[] = [
  { id: 'yunga', name: 'Юнга', hint: 'Бьёт наугад, добивает не всегда' },
  { id: 'michman', name: 'Мичман', hint: 'Ищет через клетку, добивает уверенно' },
  { id: 'admiral', name: 'Адмирал', hint: 'Считает вероятности по всему полю' },
];

export function difficultyName(id: Difficulty): string {
  return DIFFICULTIES.find((d) => d.id === id)?.name ?? 'Противник';
}
