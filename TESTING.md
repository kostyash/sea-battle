# Testing

How this project tests, and why it tests that way. `CLAUDE.md` carries the
Angular conventions for production code; this file is only about the suite.

## The rig

`ng test` runs `@angular/build:unit-test` with the **vitest** runner in
**jsdom** — the default for new Angular projects since v22, so nothing here is
homemade. What we add on top is small and deliberate:

| Where | What it sets |
| --- | --- |
| `angular.json` → `test` | the builder, `runner: vitest`, `tsConfig: tsconfig.spec.json`, `setupFiles`, coverage on, what coverage counts |
| `vitest.config.ts` | passed through `runnerConfig` — reporters, `testTimeout`, the coverage thresholds |
| `src/test-setup.ts` | the global `beforeEach`: sweeps what the TestBed reset does not |
| `scripts/test.mjs` | turns `--run` into the builder's `--watch=false`, and `--gate` into `SB_COVERAGE_GATE=1` |

`runnerConfig` is a documented option, but the CLI overrides `test.projects` and
`test.include` in whatever it is handed — do not try to set those there.

### Global setup

Setup files are declared as **`setupFiles` on the `test` target in `angular.json`**,
not in `vitest.config.ts`: the builder writes the runner's `setupFiles` itself, as
`['init-testbed.js', 'vitest-mock-patch.js', ...yours]` with `sequence.setupFiles: 'list'`.
Anything set in the vitest config is overwritten. Ours therefore runs *after* the
TestBed is initialised, which is what makes it able to register hooks at all. A
new setup file must also be added to `tsconfig.spec.json`'s `include`, or the
compiler never sees it.

Use one for cross-cutting state that every spec needs put back and that lives
**outside the injector** — that is exactly what `src/test-setup.ts` does with
`localStorage` and the `<html>` attributes. Do not use one for setup that only a
few files need, or that a file has a specific reason for: a hook far away from
the test hides why it is there. A spec's own `beforeEach` runs after the global
one, so a file that wants a different starting state — `i18n.spec.ts` poisons
`lang`/`dir` on purpose — still gets it.

The sibling option **`providersFile`** does the same job for Angular providers
every test should have. Nothing here needs one yet.

### Commands

```bash
npm test -- --run        # the whole suite, once
npm run test:coverage    # the same, with the thresholds armed
npm run test:sim         # 500 games a level; slow, only when ai/ moved
```

`npm test` on its own **watches** and never returns. `--run` is not optional.

## Zoneless, and what follows from it

There is no `polyfills` entry in `angular.json`, so zone.js is not in the build
and not in the tests. The builder's setup only provides `provideZoneChangeDetection()`
when `Zone` is defined, which means **the TestBed runs zoneless here** — the same
mode as production, with no `provideZonelessChangeDetection()` needed.

### `detectChanges()` is correct in this suite

Angular's guidance is to prefer `await fixture.whenStable()` over
`fixture.detectChanges()`, so that a test exercises the notifications production
relies on rather than forcing a pass by hand. The same guidance adds that for an
existing suite, converting is likely not worth the effort — and here there is a
harder reason.

**Measured, not assumed:** under `vi.useFakeTimers()`, `await fixture.whenStable()`
never resolves and the test dies on the 15 s timeout. On real timers the same
component settles in about 50 ms. Most component specs here run on fake timers,
because the store lives on `PAUSE` timers and a battle has to play out at once
rather than in real seconds. So:

- **Fake timers in the test → `fixture.detectChanges()`.** There is no choice.
- **No fake timers → `await fixture.whenStable()`** is preferred in new tests.

Set inputs with `fixture.componentRef.setInput(name, value)`, never by assigning
to the instance: assignment is exactly the un-notified update zoneless is
entitled to miss, and the TestBed will throw `ExpressionChangedAfterItHasBeenCheckedError`
at you for it.

## What resets itself, and what does not

The builder registers `beforeEach(getCleanupHook(false))` and
`afterEach(getCleanupHook(true))`, and that hook calls `TestBed.resetTestingModule()`.
**Do not write `TestBed.resetTestingModule()` in a `beforeEach`** — it is already
done. It is proven, not assumed: two consecutive tests can each call
`configureTestingModule` from scratch, which would throw "Cannot configure the
test module when the test module has already been instantiated" if no reset
happened between them.

A mid-test reset is a different thing and is legitimate — it is how a test builds
a *second* injector to compare against the first, as in "one seed — one and the
same enemy deployment". Three of those exist and they earn their place.

What the reset does **not** touch is everything outside the injector:

- `localStorage` — `setLang` writes `sb.lang`, and a language left behind changes
  the sentences every later test reads.
- the `lang` and `dir` attributes on `<html>`, stamped there by the i18n effect.
- global stubs (`vi.stubGlobal`, `Storage.prototype` in the audio spec).

The first two are swept for every test by `src/test-setup.ts`, so a spec should
not repeat them. That file is load-bearing, and has been seen red: disarm its
hook and four spec files fail on language leaking between tests. Stubs are the
spec's own business — undo them in `afterEach`, unconditionally, not at the end
of a test that may never reach its end.

## House rules

These are ours, not Angular's, and they have all been paid for at least once.

- **A guard test proves nothing until it has been seen red.** Add one, break the
  code it guards, watch it fail, put the code back. A green new test is not
  evidence.
- **Beware assertions that cannot fail.** `computed` memoises, so "ask twice, get
  the same answer" is vacuous — the second read never runs. Compare something
  that was asked against something that was not.
- **Do not borrow the code under test to state the expectation.** The coordinate
  helper in `panels.spec.ts` spells `A1` out by hand for exactly this reason: an
  assertion that called `I18n.coord()` would agree with whatever that returned.
- **Property tests are honest CPU work.** `testTimeout` is 15 s because the CI
  runner is about three times slower than the laptop, not because anything hangs.
- **Randomness is injected.** Tests pass a seed through `GAME_SEED`; a test that
  wants numbers of its own derives a separate seed rather than drawing from the
  game's.

## Coverage

`npm test` must fail on failing tests and **not** on percentages — the thresholds
are armed only by `npm run test:coverage`, through `SB_COVERAGE_GATE=1`. The bar:
95% of lines and branches on `src/app/domain/**`, `src/app/ai/**` and
`src/app/i18n/**`; 70% overall.

Do not leave `ng serve` running while the gate runs — they fight over the same
build output and the gate reports nonsense.
