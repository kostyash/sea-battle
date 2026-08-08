import { beforeEach } from 'vitest';

/**
 * Global setup, listed as `setupFiles` on the `test` target in `angular.json`.
 * The builder always runs its own TestBed initialisation before this file, so
 * the testing environment is up by the time these hooks are registered.
 *
 * The TestBed itself is reset between tests by the runner. What it does not
 * touch is everything outside the injector — and this game keeps two things
 * there: the language, remembered in `localStorage`, and the `lang`/`dir`
 * attributes the i18n effect stamps onto `<html>`. Left standing, either one
 * decides the outcome of whichever test runs next, which is how a suite starts
 * passing or failing by the order it happens to run in.
 *
 * A spec that wants a different starting state still sets it in its own
 * `beforeEach` — those run after this one, so deliberate poisoning still works.
 */
beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('lang');
  document.documentElement.removeAttribute('dir');
});
