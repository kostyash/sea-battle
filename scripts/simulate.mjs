#!/usr/bin/env node
/**
 * Симуляция партий: гоняет три уровня противника по одинаковым расстановкам и
 * проверяет, что они выстраиваются по силе — Адмирал < Мичман < Юнга по числу
 * залпов до разгрома флота.
 *
 * Медленно (тысячи партий), поэтому живёт отдельной командой `npm run test:sim`,
 * а не в общем прогоне. Исходники домена и противника собираются esbuild-ом:
 * это тот же код, что и в приложении, без всякой подмены.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const GAMES = Number(process.env['SB_SIM_GAMES'] ?? 500);
const ROOT = process.cwd();

const ENTRY = `
export { randomBoard } from './src/app/domain/placement';
export { seededRng } from './src/app/domain/rng';
export { afloatSizes, fire, isFleetDestroyed } from './src/app/domain/shot';
export { chooseShot } from './src/app/ai/opponent';
`;

const work = mkdtempSync(join(tmpdir(), 'sea-battle-sim-'));
const entryPath = join(ROOT, '.sim-entry.ts');
const bundlePath = join(work, 'sim.mjs');

function fail(message) {
  console.error(`\n  ✗ ${message}\n`);
  cleanup();
  process.exit(1);
}

function cleanup() {
  rmSync(entryPath, { force: true });
  rmSync(work, { recursive: true, force: true });
}

writeFileSync(entryPath, ENTRY, 'utf-8');

try {
  const esbuild = await import('esbuild');
  await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundlePath,
    logLevel: 'error',
  });
} catch (error) {
  console.error(error?.message ?? error);
  fail('не удалось собрать симуляцию');
}

const { randomBoard, seededRng, afloatSizes, fire, isFleetDestroyed, chooseShot } = await import(
  pathToFileURL(bundlePath).href
);

/** Одна партия: сколько залпов ушло на весь флот. */
function shotsToWin(level, layoutSeed, aiSeed) {
  let board = randomBoard(seededRng(layoutSeed), 'player');
  const rng = seededRng(aiSeed);
  let shots = 0;

  while (!isFleetDestroyed(board)) {
    const cell = chooseShot(board.shots, afloatSizes(board), level, rng);
    if (cell === -1) throw new Error('стрелять некуда, а флот жив');
    if (board.shots[cell] !== 'unknown') throw new Error(`повторный выстрел в ${cell}`);
    board = fire(board, cell).board;
    shots++;
    if (shots > 100) throw new Error('партия не сходится');
  }
  return shots;
}

const LEVELS = [
  { id: 'yunga', name: 'Юнга' },
  { id: 'michman', name: 'Мичман' },
  { id: 'admiral', name: 'Адмирал' },
];

console.log(`\n  Симуляция: ${GAMES} партий на уровень, одинаковые расстановки\n`);

const stats = new Map();
try {
  for (const level of LEVELS) {
    const runs = [];
    for (let g = 0; g < GAMES; g++) runs.push(shotsToWin(level.id, g, g * 7919 + 13));
    runs.sort((a, b) => a - b);
    const mean = runs.reduce((s, x) => s + x, 0) / runs.length;
    stats.set(level.id, mean);
    console.log(
      `  ${level.name.padEnd(8)} среднее ${mean.toFixed(2)}  ` +
        `медиана ${runs[runs.length >> 1]}  лучшая ${runs[0]}  худшая ${runs[runs.length - 1]}`,
    );
  }
} catch (error) {
  console.error(error?.message ?? error);
  fail('партия сломалась посреди симуляции');
}

const yunga = stats.get('yunga');
const michman = stats.get('michman');
const admiral = stats.get('admiral');

console.log('');
if (!(admiral < michman)) fail(`Адмирал (${admiral.toFixed(2)}) не лучше Мичмана (${michman.toFixed(2)})`);
if (!(michman < yunga)) fail(`Мичман (${michman.toFixed(2)}) не лучше Юнги (${yunga.toFixed(2)})`);

console.log(
  `  ✓ порядок силы соблюдён: Адмирал ${admiral.toFixed(2)} < ` +
    `Мичман ${michman.toFixed(2)} < Юнга ${yunga.toFixed(2)}\n`,
);

cleanup();
