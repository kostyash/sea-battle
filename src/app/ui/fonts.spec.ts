import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The game asks nothing of any host but its own.
 *
 * The typefaces used to come from fonts.googleapis.com, which put a DNS lookup
 * and a TLS handshake to two other hosts in front of the first paint — and put
 * a record of every visit on someone else's server. They are served from here
 * now, and this guard is what keeps a later edit from quietly reaching outside
 * again: it is far too easy to paste a `<link>` from a font site and never
 * notice the request came back.
 */
const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const FONT_DIR = join(SRC, 'fonts');
const LICENCE = join(ROOT, 'public', 'fonts', 'LICENSE.txt');

const stripComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, ' ');

const cssFiles = (): string[] =>
  readdirSync(SRC, { recursive: true, encoding: 'utf-8' })
    .map((entry) => join(SRC, entry))
    .filter((path) => path.endsWith('.css'));

const fonts = readFileSync(join(SRC, 'fonts.css'), 'utf-8');

describe('the typefaces are served from this origin', () => {
  it('no stylesheet fetches anything from a font host', () => {
    for (const path of cssFiles()) {
      const css = stripComments(readFileSync(path, 'utf-8'));
      expect(css, path).not.toContain('fonts.googleapis.com');
      expect(css, path).not.toContain('fonts.gstatic.com');
    }
  });

  it('the page itself links to no outside host either', () => {
    // Comments are cut first: a commented-out <link> is not a request, and a
    // guard that counted one would go red for the wrong reason.
    const html = readFileSync(join(SRC, 'index.html'), 'utf-8').replace(/<!--[\s\S]*?-->/g, ' ');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
    expect(html).not.toMatch(/<link[^>]+href=["']https?:\/\//i);
  });

  it('every face it declares is a file that is actually there', () => {
    const urls = [...fonts.matchAll(/url\('\.\/fonts\/([^']+)'\)/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const file of urls) {
      expect(existsSync(join(FONT_DIR, file)), `${file} is declared but missing`).toBe(true);
    }
  });

  it('every file that is there is declared, so none is shipped for nothing', () => {
    const declared = new Set([...fonts.matchAll(/url\('\.\/fonts\/([^']+)'\)/g)].map((m) => m[1]));
    const present = readdirSync(FONT_DIR).filter((f) => f.endsWith('.woff2'));
    for (const file of present) {
      expect(declared.has(file), `${file} is shipped but no rule uses it`).toBe(true);
    }
  });

  /**
   * The bug this exists for: an absolute `/fonts/...` resolves to the domain
   * root, and on Pages the game is served from a subdirectory — so every font
   * 404'd in production while working perfectly on a dev server mounted at `/`.
   * Relative paths are also what lets the build hash the files.
   */
  it('asks for its fonts relative to itself, so a subdirectory does not break them', () => {
    for (const url of fonts.match(/url\([^)]*\)/g) ?? []) {
      expect(url, 'an absolute path breaks the game under a subdirectory').not.toMatch(
        /url\(['"]?\//,
      );
    }
    const html = readFileSync(join(SRC, 'index.html'), 'utf-8').replace(/<!--[\s\S]*?-->/g, ' ');
    expect(html, 'index.html must not point at the domain root either').not.toContain('"/fonts/');
  });

  /**
   * Every face carries the range it covers, so a browser fetches only the
   * alphabets the page uses. Without this an English visitor would pay for the
   * Cyrillic and the Hebrew as well.
   */
  it('every face declares the alphabet it covers, and swaps rather than blocking', () => {
    const faces = fonts.split('@font-face').slice(1);
    expect(faces.length).toBeGreaterThan(0);
    for (const face of faces) {
      expect(face).toContain('unicode-range:');
      expect(face).toContain('font-display: swap');
    }
  });

  it('the licence of the fonts is shipped beside them, as it requires', () => {
    const licence = readFileSync(LICENCE, 'utf-8');
    expect(licence).toContain('SIL Open Font License');
    for (const family of ['Forum', 'PT Sans Narrow', 'IBM Plex Mono', 'Frank Ruhl Libre', 'Heebo']) {
      expect(licence, `${family} is unattributed`).toContain(family);
    }
  });
});
