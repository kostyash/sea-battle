import { defineConfig } from 'vitest/config';

/**
 * Coverage thresholds only switch on in the gate (`npm run test:coverage`), so
 * that an ordinary `npm test` run fails on failing tests and not on percentages.
 * The pure game logic and the opponent are required to be covered almost in
 * full; the rest of the application makes do with the overall threshold.
 *
 * The `@angular/build:unit-test` builder mixes its own Angular setup in here.
 */
const gate = process.env['SB_COVERAGE_GATE'] === '1';

export default defineConfig({
  test: {
    // In CI the step's logs are unreachable without a token, so vitest is asked
    // to report failures as annotations — those are visible through the public
    // checks API.
    reporters: process.env['CI'] ? ['default', 'github-actions'] : ['default'],

    // The property-based tests walk thousands of deployments and games: honest
    // CPU work, not a hang. The CI runner is three times slower than the laptop,
    // and the standard five seconds are not enough for it.
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      thresholds: gate
        ? {
            lines: 70,
            branches: 70,
            'src/app/domain/**': { lines: 95, branches: 95 },
            'src/app/ai/**': { lines: 95, branches: 95 },
            // The dictionaries decide what the player reads, and a wrong plural
            // or a missing key is a visible defect — the same bar as the rules.
            'src/app/i18n/**': { lines: 95, branches: 95 },
          }
        : undefined,
    },
  },
});
