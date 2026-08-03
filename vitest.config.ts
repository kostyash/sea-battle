import { defineConfig } from 'vitest/config';

/**
 * Пороги покрытия включаются только в воротах (`npm run test:coverage`), чтобы
 * обычный прогон `npm test` падал ровно на упавших тестах, а не на процентах.
 * Чистая логика игры и противник обязаны быть покрыты почти целиком,
 * остальному приложению хватает общего порога.
 *
 * Билдер `@angular/build:unit-test` подмешивает сюда свою сборку Angular.
 */
const gate = process.env['SB_COVERAGE_GATE'] === '1';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: gate
        ? {
            lines: 70,
            branches: 70,
            'src/app/domain/**': { lines: 95, branches: 95 },
            'src/app/ai/**': { lines: 95, branches: 95 },
          }
        : undefined,
    },
  },
});
