import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Анимации в игре не декоративная мелочь: гидролокатор крутится постоянно,
 * попадание пульсирует, всплеск расходится кругами. Для тех, кому движение
 * мешает, всё это обязано выключаться — и обязано продолжать выключаться после
 * любой правки стилей, поэтому запрет проверяется по исходникам.
 */
const STYLE_ROOT = join(process.cwd(), 'src');

function styleFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf-8' })
    .map((entry) => join(dir, entry))
    .filter((path) => path.endsWith('.css'));
}

/**
 * Закомментированное правило не действует. Без вырезания комментариев этот
 * страж оставался бы зелёным, даже если весь блок отключения движения
 * закомментировать целиком — ровно та дыра, что была в no-global-random.spec.
 */
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, ' ');

const read = (path: string): string => stripComments(readFileSync(path, 'utf-8'));

describe('движение отключается по просьбе системы', () => {
  it('глобальные стили гасят анимации и переходы', () => {
    const global = read(join(STYLE_ROOT, 'styles.css'));
    expect(global).toContain('prefers-reduced-motion: reduce');
    expect(global).toMatch(/animation-duration:\s*0\.001ms\s*!important/);
    expect(global).toMatch(/transition-duration:\s*0\.001ms\s*!important/);
  });

  it('глушилка бьёт по всем элементам, а не по горстке классов', () => {
    const global = read(join(STYLE_ROOT, 'styles.css'));
    const block = global.slice(global.indexOf('prefers-reduced-motion'));
    expect(block).toMatch(/\*\s*,|\*\s*\{/);
  });

  it('бесконечные повторы обрываются — иначе мигание остаётся миганием', () => {
    // Это и есть защита от вечной пульсации: одной только длительности мало,
    // повтор надо оборвать явно. Локальные блоки в компонентах не требуются —
    // глобальное правило бьёт по `*` с `!important` и перекрывает их стили.
    const global = read(join(STYLE_ROOT, 'styles.css'));
    expect(global).toMatch(/animation-iteration-count:\s*1\s*!important/);

    const infinite = styleFiles(STYLE_ROOT).filter((path) =>
      /animation:[^;]*infinite/.test(read(path)),
    );
    expect(infinite.length).toBeGreaterThan(0); // есть что обрывать
  });

  it('в проекте вообще есть что глушить', () => {
    const withMotion = styleFiles(STYLE_ROOT).filter((path) => /@keyframes/.test(read(path)));
    expect(withMotion.length).toBeGreaterThan(0);
  });

  it('сам страж не считает закомментированное правило действующим', () => {
    expect(stripComments('/* @media (prefers-reduced-motion: reduce) {} */')).not.toContain(
      'prefers-reduced-motion',
    );
    expect(stripComments('@media (prefers-reduced-motion: reduce) {}')).toContain(
      'prefers-reduced-motion',
    );
  });
});

describe('мобильная раскладка', () => {
  const shell = () => read(join(STYLE_ROOT, 'app', 'app.css'));

  it('узкий экран получает одну колонку, широкий — три', () => {
    const css = shell();
    expect(css).toMatch(/grid-template-columns:\s*1fr/);
    expect(css).toContain('@media (min-width: 820px)');
    expect(css).toContain('@media (min-width: 1180px)');
  });

  it('в расстановке своя карта идёт первой, в бою — чужая', () => {
    const css = shell();
    expect(css).toMatch(/\.sea--away\s*\{\s*order:\s*1/);
    expect(css).toMatch(/\.phase-deploy\s+\.sea--home\s*\{\s*order:\s*1/);
  });

  it('заголовок переносится, а не вылезает за поля', () => {
    expect(shell()).toContain('overflow-wrap: break-word');
  });
});
