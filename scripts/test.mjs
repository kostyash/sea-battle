#!/usr/bin/env node
/**
 * Обёртка над `ng test`.
 *
 * Нужна по двум причинам:
 *  - привычный для vitest флаг `--run` Angular CLI не понимает, а гонять тесты
 *    хочется командой `npm test -- --run`; здесь он превращается в `--watch=false`;
 *  - порог покрытия включается переменной окружения, чтобы обычный прогон тестов
 *    и ворота покрытия были разными командами (см. vitest.config.ts).
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
