#!/usr/bin/env node
/**
 * Game simulation: runs the three opponent levels over identical deployments and
 * checks that they line up by strength — Admiral < Midshipman < Cabin Boy by the
 * number of salvos needed to destroy the fleet.
 *
 * It is slow (thousands of games), so it lives in a separate command,
 * `npm run test:sim`, rather than in the general run. The domain and opponent
 * sources are bundled with esbuild: this is the same code as in the application,
 * with nothing substituted.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const GAMES = Number(process.env['SB_SIM_GAMES'] ?? 500);
const ROOT = process.cwd();

const ENTRY = `
export { randomBoard } from './src/app/domain/placement';
export { hiddenBoard } from './src/app/ai/berthing';
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
  fail('failed to build the simulation');
}

const { randomBoard, hiddenBoard, seededRng, afloatSizes, fire, isFleetDestroyed, chooseShot } =
  await import(
    pathToFileURL(bundlePath).href
  );

/** A single game: how many salvos the whole fleet took. */
function shotsToWin(level, layoutSeed, aiSeed, moor = randomBoard) {
  let board = moor(seededRng(layoutSeed), 'player');
  const rng = seededRng(aiSeed);
  let shots = 0;

  while (!isFleetDestroyed(board)) {
    const cell = chooseShot(board.shots, afloatSizes(board), level, rng);
    if (cell === -1) throw new Error('nowhere left to shoot, yet the fleet is alive');
    if (board.shots[cell] !== 'unknown') throw new Error(`repeated shot at ${cell}`);
    board = fire(board, cell).board;
    shots++;
    if (shots > 100) throw new Error('the game does not converge');
  }
  return shots;
}

const LEVELS = [
  { id: 'cabin-boy', name: 'Cabin Boy' },
  { id: 'midshipman', name: 'Midshipman' },
  { id: 'admiral', name: 'Admiral' },
];

console.log(`\n  Simulation: ${GAMES} games per level, identical deployments\n`);

const stats = new Map();
try {
  for (const level of LEVELS) {
    const runs = [];
    for (let g = 0; g < GAMES; g++) runs.push(shotsToWin(level.id, g, g * 7919 + 13));
    runs.sort((a, b) => a - b);
    const mean = runs.reduce((s, x) => s + x, 0) / runs.length;
    stats.set(level.id, mean);
    console.log(
      `  ${level.name.padEnd(11)} mean ${mean.toFixed(2)}  ` +
        `median ${runs[runs.length >> 1]}  best ${runs[0]}  worst ${runs[runs.length - 1]}`,
    );
  }
} catch (error) {
  console.error(error?.message ?? error);
  fail('a game broke in the middle of the simulation');
}

const cabinBoy = stats.get('cabin-boy');
const midshipman = stats.get('midshipman');
const admiral = stats.get('admiral');

console.log('');
if (!(admiral < midshipman))
  fail(`Admiral (${admiral.toFixed(2)}) is no better than Midshipman (${midshipman.toFixed(2)})`);
if (!(midshipman < cabinBoy))
  fail(`Midshipman (${midshipman.toFixed(2)}) is no better than Cabin Boy (${cabinBoy.toFixed(2)})`);

console.log(
  `  ✓ the order of strength holds: Admiral ${admiral.toFixed(2)} < ` +
    `Midshipman ${midshipman.toFixed(2)} < Cabin Boy ${cabinBoy.toFixed(2)}\n`,
);

/**
 * The other half of the question: not how well the opponent shoots, but how
 * well it hides. The same shooter is set on the same layouts, moored evenly and
 * then moored against the hunter's map, and the difference is what the mooring
 * is worth. Paired again — it is the same layout seed on both sides.
 */
const HIDE_LEVEL = 'admiral';
const even = [];
const hidden = [];
for (let g = 0; g < GAMES; g++) {
  even.push(shotsToWin(HIDE_LEVEL, g, g * 7919 + 13, randomBoard));
  hidden.push(shotsToWin(HIDE_LEVEL, g, g * 7919 + 13, hiddenBoard));
}
const gap = hidden.map((shots, g) => shots - even[g]);
const gapMean = gap.reduce((s, x) => s + x, 0) / gap.length;
const gapVar = gap.reduce((s, x) => s + (x - gapMean) ** 2, 0) / (gap.length - 1);
const gapErr = Math.sqrt(gapVar / gap.length);

console.log('  Mooring, against the same hunter:\n');
console.log(`  drawn evenly       mean ${(even.reduce((s, x) => s + x, 0) / even.length).toFixed(2)}`);
console.log(
  `  drawn to hide      mean ${(hidden.reduce((s, x) => s + x, 0) / hidden.length).toFixed(2)}` +
    `   ${gapMean >= 0 ? '+' : ''}${gapMean.toFixed(2)} ± ${(gapErr * 2).toFixed(2)} salvos ` +
    `(${(gapMean / gapErr).toFixed(1)}σ)\n`,
);

cleanup();
