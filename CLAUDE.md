# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

A classic sea battle game against the computer. Angular 22, standalone
components, signals, zoneless change detection, **no runtime dependencies**
beyond Angular itself and `rxjs`/`tslib`. Published to GitHub Pages at
<https://kostyash.github.io/sea-battle/> on every push to `main`.

`README.md` is the player-facing and design-facing document — the rules, the
opponent levels, why the mooring is what it is. `PLAN.md` is the work log: the
phases, the gates, and a journal entry per closed item. Both are kept current;
when a change alters behaviour, update them in the same pass.

## Commands

Run from the repository root.

| Command | What it is for |
| --- | --- |
| `npm start` | dev server on <http://localhost:4200> |
| `npm run build` | production build; must exit 0 **with no warnings** |
| `npm test -- --run` | the whole suite, once (`--run` is mandatory — see below) |
| `npm run test:coverage` | the same suite with the coverage thresholds switched on |
| `npm run test:sim` | 500 games per level; checks the levels are ordered by strength |

### Gotchas

- `npm test` alone starts a **watch** run that never returns. Always
  `npm test -- --run`. The `scripts/test.mjs` wrapper translates `--run` into
  the builder's `--watch=false`.
- `npm test` and `npm run test:coverage` are deliberately separate: thresholds
  are only armed when `SB_COVERAGE_GATE=1`, which the `--gate` flag sets. An
  ordinary test run must fail on failing tests, not on percentages.
- Do not leave `ng serve` running while the coverage gate runs — the two fight
  over the same build output and the gate reports nonsense.
- Shell is PowerShell on Windows. Never write project files with
  `Set-Content`/`Out-File` without `-Encoding utf8`: the default adds a BOM, and
  a BOM makes GitHub Actions refuse to parse `.github/workflows/*.yml`. Prefer
  the Write/Edit tools.

## Gates before any commit

Every pass, in this order:

1. `npm run build` — exit 0, no warnings
2. `npm test -- --run` — everything green
3. `npm run test:coverage` — ≥ 95% lines/branches on `src/app/domain/**`,
   `src/app/ai/**` and `src/app/i18n/**`; ≥ 70% overall
4. `npm run test:sim` — only when `src/app/ai/**` or the store's use of it
   changed; it is slow and it asserts Admiral < Midshipman < Cabin Boy on mean
   salvos, plus the mooring being worth about +3.4 salvos

Then add a journal entry to `PLAN.md` with the actual figures from those runs.
Never report a gate as green without having run it.

## Architecture

```
src/app/domain/   pure rules, no Angular, no I/O
                  grid.ts       the 10×10 square; a cell is a number 0…99
                  fleet.ts      the roster (1×4, 2×3, 3×2, 4×1) and a placed ship
                  placement.ts  legality, the ring with its diagonals, random boards
                  shot.ts       resolving a shot, ringing a sunk ship
                  rng.ts        seeded mulberry32 behind an `Rng` interface
src/app/ai/       levels.ts     the three level ids
                  opponent.ts   Cabin Boy and Midshipman, and the entry `chooseShot`
                  density.ts    the Admiral's density map
                  berthing.ts   mooring a fleet where a density hunter looks last
                  benchmark.ts  how many salvos a strong shooter needs on a board
src/app/i18n/     en.ts ru.ts he.ts  the dictionaries; `EN` defines `MsgKey`
                  lang.ts       languages, text direction, row letters
                  i18n.ts       the service: t(), plurals, coord(), lang and dir
src/app/core/     game-store.ts signal state, phases and the turn order
                  audio.ts      every sound synthesised on WebAudio, no files
src/app/ui/       board-grid, ship-glyph, deploy-panel, battle-panel,
                  result-overlay, lang-switch
```

Rules to keep:

- **No randomness outside `Rng`.** A test reads the sources of `domain/**` and
  `ai/**` and fails on a literal `Math.random()`. Randomness is injected; the
  game's single source is `GAME_SEED`. Anything that wants numbers of its own
  (the benchmark, for instance) derives a separate seed rather than drawing from
  the game's — drawing from it would change the next battle.
- **The opponent never peeks.** `chooseShot` is handed only the marks and the
  sizes still afloat. Keep it that way.
- **Boards are replaced wholesale**, never mutated, so signals and `OnPush` work
  without contrivance.
- **The domain knows no letters.** A cell is a number; row letters are an i18n
  concern. The store keeps its status line and firing log as message keys plus
  data, so switching language mid-battle re-reads the history rather than
  stranding it in the old language.
- **The chart stays `dir="ltr"` in every language**, Hebrew included: the
  overlays are positioned by `left: %` from cell 0 and the arrow keys walk the
  same index order.

## Angular conventions

The authority is the Angular CLI MCP server, configured for this project. It is
version-aware, so consult it rather than working from memory:

- `get_best_practices` with `workspacePath: c:\sea-battle` — the official guide
  for the framework version actually installed here. Read it before writing or
  changing component code.
- `search_documentation` with `version: 22` — API signatures and concepts, with
  links to angular.dev worth citing.
- `list_projects` — the workspace map; it also reports that the test framework
  here is vitest and the style language is plain CSS.

What that guide asks for, and what this repository already does:

- **Standalone components**, and never `standalone: true` in the decorator — it
  has been the default since v20.
- **Signals for state**, `computed()` for anything derived, `linkedSignal()` when
  derived state must stay in step with several sources. Never `mutate` — `set`
  or `update`.
- **`input()` / `output()` functions**, not the decorators; `model()` for a
  two-way `[(prop)]` instead of an input paired with an output.
- **Host bindings live in the `host` object** of the decorator. `@HostBinding`
  and `@HostListener` are out.
- **Native control flow** — `@if`, `@for`, `@switch`, never `*ngIf` and friends.
- **`class` and `style` bindings**, never `ngClass`/`ngStyle`.
- **`inject()`**, not constructor injection. Services are single-responsibility
  and carry the `@Service()` decorator — `autoProvided` defaults to true, which
  is what `@Injectable({ providedIn: 'root' })` used to spell out.
- **Do not write `changeDetection`.** `OnPush` is the strategy from v22 whether
  it is stated or not, so stating it is noise.
- **Strict types**: no `any`; `unknown` where the type is genuinely unknown; let
  inference do the obvious work.
- **Accessibility is a requirement, not a polish pass**: AXE clean, WCAG AA
  minimums, focus management, contrast and ARIA. The grid is a `role="grid"` of
  `role="gridcell"` buttons with a roving tabindex, the result card is a real
  modal made true for the keyboard by `inert` on the rest of the page — that is
  the standard to hold new UI to.
- **External templates and styles are addressed relative to the component's
  `.ts`**, as `board-grid` does.

Nothing here uses forms or `NgOptimizedImage`: the one control was a range slider
that has since been removed, and every image on the page is drawn in SVG or CSS.
If a form does arrive, it is Signal Forms (`@angular/forms/signals`), stable in
v22 — and reactive forms only if something makes those impossible.

## Tests

Vitest through `@angular/build:unit-test`, jsdom. `*.spec.ts` sits next to what
it tests.

- A guard test proves nothing until it has been seen red. When adding one,
  mutate the code it guards, watch it fail, then put the code back.
- Beware assertions that cannot fail: `computed` memoises, so "asking twice
  gives the same answer" is vacuous. Compare a thing that was asked against one
  that was not.
- Property-based tests walk thousands of boards; `testTimeout` is 15 s because
  the CI runner is about three times slower than the laptop. That is honest CPU
  work, not a hang.

## Style

- Code, comments, test titles and `PLAN.md`/`README.md` are **English**. Chat
  with the user is Russian; commit messages are in the voice of the existing
  log — a short line in the register of a ship's journal.
- Comments explain *why*, not *what*, and only where the reason is not obvious
  from the code. Match the density already in the file.
- Prettier is a devDependency; keep to the formatting already in place.

## CI and deployment

`.github/workflows/deploy.yml` (its prose is Russian — leave it as it is) runs
tests, the coverage gate, the simulation and the build on every push to `main`,
then publishes to Pages. `--base-href` is set from the repository name because
the game lives in a subdirectory, not at the domain root.

`gh` is not installed on this machine, so Actions logs cannot be read directly;
vitest emits failures as annotations, which are visible through the public
checks API.
