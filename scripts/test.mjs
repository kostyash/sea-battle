#!/usr/bin/env node
/**
 * Wrapper around `ng test`.
 *
 * It exists for two reasons:
 *  - the Angular CLI does not understand `--run`, the flag everyone is used to from
 *    vitest, yet we want to run tests as `npm test -- --run`; here it is turned into
 *    `--watch=false`;
 *  - the coverage threshold is switched on by an environment variable, so that a plain
 *    test run and the coverage gate are two different commands (see vitest.config.ts).
 */
import { spawn } from 'node:child_process';

const passed = process.argv.slice(2);
const gate = passed.includes('--gate');
const forwarded = passed.filter((a) => a !== '--gate' && a !== '--run' && a !== '--watch');

const args = ['test', '--watch=false', ...forwarded];
const env = { ...process.env };
if (gate) env['SB_COVERAGE_GATE'] = '1';

const child = spawn('ng', args, {
  stdio: 'inherit',
  shell: true,
  env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
