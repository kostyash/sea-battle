import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The domain and the opponent must draw their randomness through `Rng`. A single
 * forgotten global call silently breaks the reproducibility of a game, so the ban
 * is checked against the sources rather than taken on trust.
 */
const FORBIDDEN = ['Math', 'random'].join('.');
const ROOTS = ['src/app/domain', 'src/app/ai'];

/** A mention in a comment is not a call; we compare the code only. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * A read error is deliberately NOT swallowed: `catch { return [] }` used to mean
 * that once a directory was renamed the ban ran on nothing — the guard had
 * nothing left to check, and it quietly went green.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf-8' })
    .map((e) => join(dir, e))
    .filter((p) => p.endsWith('.ts') && !p.endsWith('.spec.ts'));
}

describe('randomness only through Rng', () => {
  for (const root of ROOTS) {
    it(`${root} never calls ${FORBIDDEN}`, () => {
      const guilty = sourceFiles(join(process.cwd(), root)).filter((file) =>
        code(readFileSync(file, 'utf-8')).includes(FORBIDDEN),
      );
      expect(guilty).toEqual([]);
    });
  }

  it('the ban catches a real call, not merely the absence of files', () => {
    expect(code(`const x = ${FORBIDDEN}();`)).toContain(FORBIDDEN);
    expect(code(`// just words about ${FORBIDDEN} here`)).not.toContain(FORBIDDEN);
    expect(code(`/* and ${FORBIDDEN} inside a block, too */`)).not.toContain(FORBIDDEN);
  });

  // A safety net for both directories, not for the domain alone: otherwise a
  // vanished `ai/` would go unnoticed and the ban would "run" over an empty set of files.
  for (const root of ROOTS) {
    it(`${root} exists at all and holds source files`, () => {
      expect(sourceFiles(join(process.cwd(), root)).length).toBeGreaterThan(0);
    });
  }
});
