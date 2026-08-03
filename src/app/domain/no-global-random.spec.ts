import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Домен и противник обязаны получать случайность через `Rng`. Один забытый
 * глобальный вызов ломает воспроизводимость партии молча, поэтому запрет
 * проверяется по исходникам, а не на словах.
 */
const FORBIDDEN = ['Math', 'random'].join('.');
const ROOTS = ['src/app/domain', 'src/app/ai'];

/** Упоминание в комментарии — не вызов; сравниваем только код. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Ошибку чтения намеренно НЕ глотаем: раньше `catch { return [] }` означал,
 * что после переименования каталога запрет проходил вхолостую — стражу
 * нечего было проверять, и он молча зеленел.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf-8' })
    .map((e) => join(dir, e))
    .filter((p) => p.endsWith('.ts') && !p.endsWith('.spec.ts'));
}

describe('случайность только через Rng', () => {
  for (const root of ROOTS) {
    it(`${root} не зовёт ${FORBIDDEN}`, () => {
      const guilty = sourceFiles(join(process.cwd(), root)).filter((file) =>
        code(readFileSync(file, 'utf-8')).includes(FORBIDDEN),
      );
      expect(guilty).toEqual([]);
    });
  }

  it('запрет ловит настоящий вызов, а не только отсутствие файлов', () => {
    expect(code(`const x = ${FORBIDDEN}();`)).toContain(FORBIDDEN);
    expect(code(`// про ${FORBIDDEN} здесь только слова`)).not.toContain(FORBIDDEN);
    expect(code(`/* и ${FORBIDDEN} в блоке тоже */`)).not.toContain(FORBIDDEN);
  });

  // Страховка на оба каталога, а не только на домен: иначе исчезнувший `ai/`
  // не заметил бы никто, а запрет «выполнялся» бы на пустом множестве файлов.
  for (const root of ROOTS) {
    it(`${root} вообще существует и содержит исходники`, () => {
      expect(sourceFiles(join(process.cwd(), root)).length).toBeGreaterThan(0);
    });
  }
});
