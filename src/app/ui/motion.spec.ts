import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Motion in this game is not decorative trim: the sonar sweeps without pause, a
 * hit pulses, a splash spreads in rings. For anyone whom movement disturbs all
 * of it has to switch off — and has to keep switching off after any later edit
 * to the styles, which is why the ban is checked against the sources themselves.
 */
const STYLE_ROOT = join(process.cwd(), 'src');

function styleFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf-8' })
    .map((entry) => join(dir, entry))
    .filter((path) => path.endsWith('.css'));
}

/**
 * A commented-out rule does nothing. Without cutting the comments away this
 * guard would stay green even if the whole motion-killing block were commented
 * out wholesale — precisely the hole no-global-random.spec once had.
 */
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, ' ');

const read = (path: string): string => stripComments(readFileSync(path, 'utf-8'));

describe('motion switches off when the system asks for it', () => {
  it('the global stylesheet kills animations and transitions', () => {
    const global = read(join(STYLE_ROOT, 'styles.css'));
    expect(global).toContain('prefers-reduced-motion: reduce');
    expect(global).toMatch(/animation-duration:\s*0\.001ms\s*!important/);
    expect(global).toMatch(/transition-duration:\s*0\.001ms\s*!important/);
  });

  it('the killer covers every element rather than a handful of classes', () => {
    const global = read(join(STYLE_ROOT, 'styles.css'));
    const block = global.slice(global.indexOf('prefers-reduced-motion'));
    expect(block).toMatch(/\*\s*,|\*\s*\{/);
  });

  it('endless repeats are cut short — otherwise a flicker stays a flicker', () => {
    // This is the guard against a perpetual pulse: duration alone is not enough,
    // the repeat has to be broken off outright. No per-component blocks are
    // needed — the global rule hits `*` with `!important` and overrides them.
    const global = read(join(STYLE_ROOT, 'styles.css'));
    expect(global).toMatch(/animation-iteration-count:\s*1\s*!important/);

    const infinite = styleFiles(STYLE_ROOT).filter((path) =>
      /animation:[^;]*infinite/.test(read(path)),
    );
    expect(infinite.length).toBeGreaterThan(0); // there is something to cut short
  });

  it('the project does have motion worth silencing in the first place', () => {
    const withMotion = styleFiles(STYLE_ROOT).filter((path) => /@keyframes/.test(read(path)));
    expect(withMotion.length).toBeGreaterThan(0);
  });

  it('the guard itself does not take a commented-out rule for a live one', () => {
    expect(stripComments('/* @media (prefers-reduced-motion: reduce) {} */')).not.toContain(
      'prefers-reduced-motion',
    );
    expect(stripComments('@media (prefers-reduced-motion: reduce) {}')).toContain(
      'prefers-reduced-motion',
    );
  });
});

describe('the layout on a narrow screen', () => {
  const shell = () => read(join(STYLE_ROOT, 'app', 'app.css'));

  it('a narrow screen gets one column, a wide one gets three', () => {
    const css = shell();
    expect(css).toMatch(/grid-template-columns:\s*1fr/);
    expect(css).toContain('@media (min-width: 820px)');
    expect(css).toContain('@media (min-width: 1180px)');
  });

  it('while deploying your own chart comes first, in battle the enemy one does', () => {
    const css = shell();
    expect(css).toMatch(/\.sea--away\s*\{\s*order:\s*1/);
    expect(css).toMatch(/\.phase-deploy\s+\.sea--home\s*\{\s*order:\s*1/);
  });

  it('the heading wraps instead of running off the margin', () => {
    expect(shell()).toContain('overflow-wrap: break-word');
  });
});
