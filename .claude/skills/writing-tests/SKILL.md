---
name: writing-tests
description: Rules for writing or changing tests in this Angular 22 + vitest project. Use whenever creating a `*.spec.ts`, editing an existing one, adding a test case, fixing a failing or flaky test, changing the test config (`vitest.config.ts`, `tsconfig.spec.json`, the `test` target in `angular.json`, `scripts/test.mjs`), or deciding how to assert something. Covers the zoneless TestBed, why `detectChanges` beats `whenStable` here, what the runner resets for you, and the assertions that cannot fail.
---

# Writing tests in this project

`TESTING.md` at the repository root is the long form. This is what must not be
got wrong.

## Before you write

Run the suite once (`npm test -- --run`) so you know what green looked like
before you touched it. `npm test` without `--run` watches and never returns.

## The five rules that are actually broken most often

1. **Never write `TestBed.resetTestingModule()` in a `beforeEach`.** The builder
   already registers `beforeEach(getCleanupHook(false))` / `afterEach(getCleanupHook(true))`,
   and that hook resets the TestBed. Writing it again is noise. A reset *in the
   middle of a test* is different and fine — that is how you build a second
   injector to compare against the first.

2. **Clean up what the reset does not.** The reset rebuilds the injector and
   nothing else. If the test touches language or sound, clear it yourself:
   `localStorage.clear()`, the `lang`/`dir` attributes on `<html>`, and any
   `vi.stubGlobal`. Left behind, they decide the outcome of a later test.

3. **Fake timers and `whenStable()` do not mix.** Under `vi.useFakeTimers()`,
   `await fixture.whenStable()` never resolves — it dies on the 15 s timeout.
   This is measured, not folklore. Most specs here use fake timers because the
   store runs on `PAUSE` timers.
   - fake timers in the test → `fixture.detectChanges()`
   - no fake timers → `await fixture.whenStable()` is preferred

4. **Set inputs with `fixture.componentRef.setInput(name, value)`.** Never assign
   to the component instance: that is the un-notified update a zoneless app is
   entitled to miss, and the TestBed will throw
   `ExpressionChangedAfterItHasBeenCheckedError`.

5. **A guard test proves nothing until it has been seen red.** After adding one,
   break the code it guards, run it, watch it fail, then put the code back. Say
   in the report that you did this. A test that was green from birth is not
   evidence that it guards anything.

## Assertions that cannot fail

Check every new assertion against these before believing it:

- `computed` memoises. "Ask twice, get the same answer" never runs the second
  read — it cannot fail. Compare a thing that was asked against one that was not.
- An expectation built by calling the code under test agrees with whatever that
  code does. Spell the expected value out by hand.
- `expect(x).toBeDefined()` on something that is always defined pins nothing.
  Assert the value.

## Style

- Test titles are English sentences that say what the system does, in the voice
  of the surrounding file — not `should return true`.
- Comments explain *why* a test is shaped the way it is, and only where it is not
  obvious. Match the density already in the file.
- `*.spec.ts` sits next to the thing it tests.
- Import `describe`/`it`/`expect`/`vi` from `vitest` by name. Globals are
  deliberately not in `tsconfig.spec.json`.
- Randomness comes through `GAME_SEED`. A test that wants its own numbers derives
  a separate seed rather than drawing from the game's.

## Before you report done

1. `npm test -- --run` — everything green.
2. `npm run test:coverage` — the thresholds are armed only here (95% on
   `domain/`, `ai/`, `i18n/`; 70% overall). Do not leave `ng serve` running
   beside it.
3. `npm run test:sim` — only if `src/app/ai/**` or the store's use of it changed.
4. Add a `PLAN.md` journal line with the real figures from those runs.

Never report a gate as green without having run the command.
