/**
 * The narrow-screen pass.
 *
 * Not a gate and not part of CI: it is run by hand when the layout is touched,
 * and what it produces is meant to be looked at. It walks the game from an empty
 * chart to the first salvos at four phone widths, writes a screenshot of every
 * phase into `e2e/shots/`, and reports two things that a screenshot alone will
 * not tell you — whatever the page logged, and anything sticking out past the
 * viewport, which is how a stacked layout usually breaks.
 *
 *   npm start          # in another terminal — the pass needs the app served
 *   npm run shots      # or: npm run shots -- --headed, to watch it work
 */
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots');
const URL = process.env['SB_URL'] ?? 'http://localhost:4200/';
const HEADED = process.argv.includes('--headed');

/** The narrowest phone still sold, two current ones, and the 340 px the CSS is written to. */
const PROFILES = [
  { name: 'iphone-se', device: devices['iPhone SE'] },
  { name: 'pixel-5', device: devices['Pixel 5'] },
  { name: 'iphone-14-pro-max', device: devices['iPhone 14 Pro Max'] },
  {
    name: 'narrow-340',
    device: {
      viewport: { width: 340, height: 700 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: devices['iPhone SE'].userAgent,
    },
  },
];

/**
 * Runs in the page. Reports the scroll extents and whichever elements cross the
 * viewport's edges — only the outermost ones, since a child of an element that
 * already sticks out tells you nothing new.
 */
const overflowProbe = () => {
  const de = document.documentElement;
  const limit = de.clientWidth;
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > limit + 1 || r.left < -1) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || '').slice(0, 48),
        left: Math.round(r.left),
        right: Math.round(r.right),
      });
    }
  }
  const outermost = offenders.filter(
    (o, i) => !offenders.some((p, j) => j < i && p.left <= o.left && p.right >= o.right),
  );
  return {
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
    scrollHeight: de.scrollHeight,
    clientHeight: de.clientHeight,
    offenders: outermost.slice(0, 8),
  };
};

const tap = async (locator) => {
  await locator.scrollIntoViewIfNeeded();
  await locator.click();
};

async function walk(browser, profile) {
  const context = await browser.newContext({ ...profile.device, locale: 'en-US' });
  const page = await context.newPage();
  const logged = [];
  page.on('console', (m) => logged.push(`${m.type()}: ${m.text()}`.slice(0, 300)));
  page.on('pageerror', (e) => logged.push(`PAGEERROR: ${e.message}`.slice(0, 300)));

  /**
   * A full-page capture resizes the viewport, and Chromium drops its mobile
   * emulation while it does — after one, `(pointer: coarse)` reads false. So the
   * picture is worth having for the layout and is not to be trusted on anything
   * the input type decides: the deployment hint in it is always the mouse one.
   * What the phone would really show is measured below, before the shutter.
   */
  const shot = (tag) =>
    page.screenshot({ path: path.join(OUT, `${profile.name}-${tag}.png`), fullPage: true });

  /** Which of the two wordings of the deployment hint is the one on screen. */
  const wording = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.hint')]
        .filter((h) => getComputedStyle(h).display !== 'none')
        .map((h) => (h.classList.contains('hint--touch') ? 'touch' : 'pointer'))
        .join(),
    );

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const seen = { profile: profile.name, viewport: page.viewportSize(), phases: {} };

  seen.phases.deploy = await page.evaluate(overflowProbe);
  seen.hint = await wording();
  await shot('1-deploy');

  await tap(page.getByRole('button', { name: 'Draw lots' }));
  await page.waitForTimeout(300);
  seen.phases.placed = await page.evaluate(overflowProbe);
  await shot('2-placed');

  await tap(page.getByRole('button', { name: 'To battle' }));
  await page.waitForTimeout(500);

  // a few salvos, so that a splash, the tally and the firing log are all on screen
  const away = page.locator('app-board-grid.is-abyss');
  for (const i of [44, 45, 12]) {
    const cell = away.getByRole('gridcell').nth(i);
    if (await cell.isVisible()) {
      await tap(cell);
      await page.waitForTimeout(1400);
    }
  }
  seen.phases.battle = await page.evaluate(overflowProbe);
  await shot('3-battle');

  seen.logged = logged;
  await context.close();
  return seen;
}

const reachable = async () => {
  try {
    const res = await fetch(URL);
    return res.ok;
  } catch {
    return false;
  }
};

if (!(await reachable())) {
  console.error(`Nothing is answering at ${URL}. Start the app first: npm start`);
  process.exit(1);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  headless: !HEADED,
  // slow enough to follow by eye when someone is watching
  slowMo: HEADED ? 350 : 0,
});

const report = [];
for (const profile of PROFILES) {
  report.push(await walk(browser, profile));
}
await browser.close();

console.log(JSON.stringify(report, null, 2));

const bad = report.filter((r) => r.logged.some((l) => l.startsWith('PAGEERROR') || l.startsWith('error')));
const wide = report.filter((r) => Object.values(r.phases).some((p) => p.scrollWidth > p.clientWidth));
console.log(`\nScreenshots: ${OUT}`);
console.log(`Page errors: ${bad.length ? bad.map((r) => r.profile).join(', ') : 'none'}`);
console.log(`Sideways scroll: ${wide.length ? wide.map((r) => r.profile).join(', ') : 'none'}`);
console.log(`Deployment hint: ${report.map((r) => `${r.profile}=${r.hint}`).join(' ')}`);
