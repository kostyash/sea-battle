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

function sourceFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir, { recursive: true, encoding: 'utf-8' });
  } catch {
    return []; // каталога ещё нет — запрет выполняется сам собой
  }
  return entries
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

  it('в домене вообще есть что проверять', () => {
    expect(sourceFiles(join(process.cwd(), 'src/app/domain')).length).toBeGreaterThan(0);
  });
});
