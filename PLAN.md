# Sea Battle — work plan

The state of the cycle. One pass — one unfinished item, top to bottom.
A checkbox is ticked only after the gates have actually been run by command.

## Gates

From `C:\sea-battle`:

| Command | When |
| --- | --- |
| `npm run build` | every pass; exit 0, no warnings |
| `npm test -- --run` | every pass; everything green |
| coverage ≥ 95% of lines/branches on `src/app/domain/**` and `src/app/ai/**`, ≥ 70% overall | every pass once those directories exist |
| `npm run test:sim` | the phase 2 gate and the final gate (slow) |

The test run and the coverage gate are kept apart on purpose: `npm test` fails
only on failing tests, the thresholds are checked by `npm run test:coverage`.
Otherwise not a single item could be closed — the percentages are physically
unreachable until the code has been written.

I promised to close the 70% overall threshold in phase 3 — that promise was
wrong. After the store tests it came out at 60.1% of lines: the components (0%)
and the sound (19%) were left untouched. The threshold will close in phase 4,
once the DOM tests are in. The red gate is recorded in the journal, not hidden.

## Phase 0 — test runner

- [x] Set up vitest + `@vitest/coverage-v8`, point the `test` target at `@angular/build:unit-test`, coverage thresholds in the config, a trivial test green and coverage printed

## Phase 1 — domain (`src/app/domain`)

- [x] Seed the randomness: `Rng` as a dependency, not a single `Math.random()` in `domain/**` or `ai/**`
- [x] Move the pure logic out of `core/` into `domain/`: the grid, the fleet roster (1×4, 2×3, 3×2, 4×1), the coordinates
- [x] Legality of a deployment, including the ban on touching at the corners
- [x] Resolving a shot: miss / hit / sunk with the automatic ring of misses
- [x] Phase 1 gate: exhaustive unit tests + the property "1000 seeded deployments are legal"

## Phase 2 — opponent (`src/app/ai`)

- [x] Three levels on a shared seeded Rng: Cabin Boy, Midshipman, Admiral
- [x] Admiral: aiming by a density map of probable deployments
- [x] Determinism tests: one seed — one and the same sequence of shots
- [x] Phase 2 gate: `npm run test:sim`, 500 games, the mean number of salvos Admiral < Midshipman < Cabin Boy

## Phase 3 — signal store

- [x] Game phases, the turn order, the "hit — fire again" rule, victory/defeat, statistics
- [x] Phase 3 gate: state-machine tests that play a game through to each terminal state

## Phase 4 — components

- [x] DOM tests for the board: deployment, rotation, taking a ship back off
- [x] DOM tests for the battle: firing, cells locked during the opponent's turn
- [x] DOM tests for the fleet roster, the firing log and the result card

## Phase 5 — finishing

- [x] Styling, `prefers-reduced-motion`, keyboard navigation across the grid, the mobile layout
- [x] Final gate: the whole test suite + the production build + `npm run test:sim`

## Phase 6 — three languages

- [x] English as the language the code is written in: every comment, test title and
      journal entry rewritten out of Russian
- [x] A runtime i18n layer: English, Russian and Hebrew, switched from the masthead
      and remembered between visits
- [x] Right to left for Hebrew, with the chart itself deliberately left to right
- [x] The whole game on one screen at 1920 × 1080, without a page scrollbar
- [x] Phase 6 gate: the whole suite + the production build + `npm run test:sim`,
      coverage held to 95% on `src/app/i18n/**` as well

## Open items (next pass)

All the phases are closed, the gates are green. Below is what was deliberately
put off.

- [ ] Self-hosted fonts instead of Google Fonts. Right now `index.html` pulls
      Forum, PT Sans Narrow and IBM Plex Mono from a third-party domain, and
      since phase 6 also Frank Ruhl Libre and Heebo for the Hebrew the other
      three do not carry: this is the game's only external dependency and the
      reason for the orange FCP of 1.0 s in Lighthouse (its remaining complaints
      are browser extensions and the fixed `max-age=600` of Pages itself, nothing
      to fix there). Hosting them ourselves will add ~150–250 KB of woff2 — more
      now that Hebrew is in — but it will remove the outside request and the
      flicker of the fallback font.
- [ ] Cosmetics from the review (nothing changes in behaviour, hence deferred):
      unused tokens in `styles.css`; `enemyStats` in the store, which nobody
      reads; the `[class.ghosted]` binding with no rule in the CSS, together with
      `ghostCells`; `mustFinish` in `density.ts`, needed only by the tests;
      the hand-written `Math.floor(cell / 10)` while `rowOf`/`colOf` are right there;
      `touchesForeignHit`, which repeats the eight-neighbourhood walk from `aura`;
      `ghostGlyphStyle`, a word-for-word copy of `glyphStyle`; the duplicated
      tally+record+report in `fireAt` and `enemyVolley`.
- [ ] Uncovered paths from the review: the pointer path
      `pointerenter → cellEnter → setHover → ghost` (backstopped by focus) and
      `splash` (the side of the chart and the reset on `newGame`). The other two
      entries on this list closed themselves in phase 6: the "к" key is now one
      of three rotate keys and is under test, and the word forms
      "корабль/корабля/кораблей" are decided by `Intl.PluralRules`.
- [ ] The mobile layout has only been checked by squeezing the container down to
      340 px: a real narrow screen could not be opened during the session. Worth
      a look on an actual phone. The one-screen rule of phase 6 deliberately
      starts at 1180 px and leaves narrow screens scrolling.
- [ ] Hebrew has been read once, by one reviewer. Worth a native speaker's eye
      before it is announced anywhere — the register is meant to be a chart-room
      officer's, and that is easy to miss by a shade.

## Journal

<!-- one line per closed item -->

- Phase 0 closed: `@angular/build:unit-test` + vitest 4, the `scripts/test.mjs` wrapper
  turns `--run` into `--watch=false`. `npm run build` exit 0 with no warnings,
  `npm test -- --run` — 1/1 green, coverage is printed (0.78% of lines).
  `npm run test:coverage` is red on the 70% overall threshold — as expected, it closes in phase 3.
- Phase 1, item 1: `domain/rng.ts` — mulberry32 behind an `Rng` interface (`next`/`int`/`pick`),
  the seed taken from entropy moved out into a separate function. The ban on global randomness
  is checked by a test that reads the sources of `domain/**` and `ai/**` (comments are stripped
  before the check, and the stripper itself is covered too). Build exit 0 with no warnings,
  `npm test -- --run` — 19/19, `rng.ts` 100% of lines/branches/functions, overall coverage 2.76%.
- Phase 1, item 2: the grid and the coordinates moved into `domain/grid.ts` (plus a shared `inBounds`
  that replaced four hand-written bounds checks), the fleet roster and `Ship`/`isSunk` —
  into `domain/fleet.ts`. `core/models.ts` shrank to `Board`, the marks and the opponent levels;
  all seven consumers were switched to the new paths. Build exit 0 with no warnings,
  `npm test -- --run` — 41/41, `grid.ts`/`fleet.ts`/`rng.ts` at 100% each, overall coverage 4.24%.
- Phase 1, item 3: `domain/board.ts` (the board type and the marks) and `domain/placement.ts`
  (a ship's cells, the ring with its diagonals, `canPlace`, placing/removing, `legalSpots`,
  the seeded `randomBoard`). The ban on touching at the corners is checked across all four diagonals.
  `randomBoard` takes `Rng` as a parameter, and the budget of attempts was moved out into an
  argument — otherwise the fallback deployment could not have been exercised. Build exit 0 with no
  warnings, `npm test -- --run` — 78/78, `placement.ts` 100% of lines / 97.14% of branches
  (the only thing left uncovered is the dead end of the random draw, unreachable on an empty field),
  the rest of the domain 100%. Overall coverage 13.9%.
- Phase 1, item 4: `domain/shot.ts` — the shot, the destruction of the fleet, the calibres afloat.
  `core/board.ts` deleted entirely. Verified that the ring around a sunk ship overwrites neither
  the earlier misses nor a neighbouring sunk ship, and does not spill over the edge.
  Build exit 0, `npm test -- --run` — 96/96, `shot.ts` 100%.
- Phase 1, the gate: 96/96 green; the property over 1000 seeded deployments checks the roster,
  that the cells match the calibre, the absence of overlaps and of contact along the diagonal.
  The domain as a whole — 100% of lines / 98.18% of branches against a threshold of 95. Separately
  I made sure the per-directory threshold fires at all: I temporarily raised it to 101% and got the
  expected error, then put 95% back. Overall coverage 16.1% — it closes in phase 3.
- Out of turn, on a player's complaint: the silhouette under the cursor showed the wrong size.
  The culprit was `padding: 8%` on `.hull__glyph` — a percentage is computed from the width, so on
  the four-decker the padding ate into the height of the cell, and the aspect-preserving SVG was
  squeezed the harder the longer the ship. The padding is gone (the margins are built into the
  hull's viewBox); at the same time the number of decks was labelled in the fleet roster, so that
  the size is visible before hovering. Build exit 0, `npm test -- --run` — 96/96.
  The DOM test for this will land in phase 4.
- Phase 2, item 1: the opponent moved to `src/app/ai` — `levels.ts` (the three levels),
  `opponent.ts` (Cabin Boy and Midshipman) and `density.ts` (Admiral). `chooseShot` takes `Rng`
  as its fourth parameter, no global randomness is left. The circular import between
  `opponent` and `density` is broken: the density map returns -1, and falling back to the
  Midshipman search is the caller's decision. `core/ai.ts` and `core/models.ts` are deleted; in
  `core` only the store and the sound are left. Build exit 0, `npm test -- --run` — 122/122,
  `ai/**` 100% of lines / 95.12% of branches.
- Phase 2, item 2: the density map is verified by behaviour rather than by the fact of a call —
  symmetry on an empty field, the centre worth more than a corner, a miss dragging its neighbours
  down, a wound switching the map into finishing-off mode and zeroing out everything that does not
  continue the wounded ship, the flanks of a wounded line zeroed out by the no-contact rule. The
  dead end is checked separately: the map returns -1, and the Admiral falls back into the
  Midshipman search instead of stalling. Build exit 0,
  `npm test -- --run` — 142/142, `ai/**` 100% of lines / 97.56% of branches.
- Phase 2, item 3: determinism is checked over a whole game rather than a single shot —
  for each level the entire sequence of cells and all of the outcomes are compared. On top of that,
  it is verified that a different opponent seed and a different deployment give a different game,
  that the same cell is never fired at twice, and that the three levels on one seed play differently.
  `npm test -- --run` — 158/158.
- Phase 2, the gate: `npm run test:sim` — 500 games per level on identical
  deployments. Admiral 55.16 < Midshipman 57.05 < Cabin Boy 63.10, the order of strength holds.
  The simulation builds the same sources with esbuild, without a separate copy of the rules.
  Build exit 0, `npm test -- --run` — 158/158.
- Phase 3: the store gained a seam — the game's seed arrives through `GAME_SEED`,
  so both the opponent's deployment and its shots are repeatable in the tests.
  The state machine was played through to both terminal states: victory (the whole fleet shot to pieces)
  and defeat (the player only misses, the opponent finishes off what is left of its own). Verified: the
  "hit — fire again" rule, the lock during the opponent's turn, the ban on a second shot
  into the same cell, the deferred result card and the fact that once dismissed it does not pop back up,
  the reset of a new game and the cancelling of the previous one's timers. Build exit 0,
  `npm test -- --run` — 192/192, `game-store.ts` 95.6% of lines / 87.9% of branches.
  The 70% overall threshold is still red: 60.1% of lines — the components are not covered, that is phase 4.
- Phase 4: DOM tests in three layers. The board — a hundred cells, the roles of the rows, the coordinate
  labels, the lock, rotation with the right button, walking with the arrow keys up against the edges,
  the silhouette of the right size in both orientations, the shot marks. The panels — the number of decks
  for each class, selection and exhaustion, the random draw and clearing, the battle button, the log and
  the result card. The whole assembly — a click places a ship and takes it back off, R rotates only during
  deployment, on the opponent's turn the enemy square is closed and opens back up.
  Build exit 0, `npm test -- --run` — 256/256. **The coverage gate is green for the first time:**
  84.1% of lines / 91.1% of branches against a threshold of 70, the domain and the opponent still above 95.
- Phase 5: switching motion off is verified through the styles — the global rule hits `*`
  with `!important` and cuts off infinite repeats, otherwise the "opponent's turn" pulsing
  would have stayed pulsing. The first version of the test demanded such a block in every file
  with an animation; that is dogma for its own sake — the global rule overrides the component
  styles anyway, so the test was rewritten to check the mechanism itself. The mobile layout
  is verified through the media queries and the order of the charts: during deployment your own comes
  first, in battle the enemy's. Walking the grid from the keyboard was already covered by DOM tests
  back in phase 4.
- The final gate: production build exit 0 with no warnings (55.3 kB gzip),
  `npm test -- --run` — 263/263, coverage 84.1% of lines / 91.1% of branches / 95.6% of functions
  against thresholds of 70 and 95 for the domain and the opponent, `npm run test:sim` — Admiral 55.16 <
  Midshipman 57.05 < Cabin Boy 63.10. The game is published: https://kostyash.github.io/sea-battle/
- Phase 6, three languages. English became the language the code is written in:
  every comment, every test title and this journal were rewritten out of Russian,
  and the opponent's level ids went with them (`yunga`/`michman` are now
  `cabin-boy`/`midshipman`). The simulation is the proof that the rename touched
  nothing real — Admiral 55.16 < Midshipman 57.05 < Cabin Boy 63.10, the same
  three numbers as before it.
  What the player sees now comes from `src/app/i18n`: English defines the keys and
  `Dictionary` is `Record<MsgKey, Phrase>`, so a Russian or Hebrew phrase that is
  missing does not compile rather than showing a blank. Counting is left to
  `Intl.PluralRules` — that closes the "корабль/корабля/кораблей" item, and it is
  worth saying that guessing the categories by hand would have got Hebrew wrong:
  modern CLDR gives it one/two/other and no `many` at all.
  Two things had to leave the domain for this to work. Row letters (A…J, А…К, א…י)
  and ship-class names are words, so `domain/grid.ts` lost `coordLabel` and
  `domain/fleet.ts` lost `ShipClass.name`; the rules now only ever know a cell as a
  number 0…99. And the store stopped keeping finished sentences: `message` holds a
  key plus data, `LogEntry` holds a cell index and a ship length. That is what lets
  a language switch mid-battle re-read the status line and the whole firing log
  instead of stranding them in the language they happened in.
  Hebrew turns the page over to `dir="rtl"`, but the chart is pinned `dir="ltr"`:
  its hulls, silhouettes and splashes are placed by `left: %` from cell 0 and the
  arrow keys walk that same index order, so mirroring the square would break both,
  and squared paper has no reading direction to respect. There is a test for it,
  because it is exactly the sort of decision a later tidy-up would undo.
  Reviewed by three readers afterwards, and it earned its keep three times over.
  The wording: the Hebrew had a definite article prefixed to a construct chain
  ("הספינת קרב", the equivalent of "the-battle ship"), `כל` before an indefinite
  plural, a lamp's on/off pair used for sound, and one player addressed as both
  "you" and "you all" five words apart; the English had "finishes off surely" and
  a present-then-past "fires at B4 — missed". All fixed.
  Accessibility, and this one was made worse by the change itself: the result card
  has always declared `aria-modal`, which tells a screen reader the rest of the
  page is not there, while Tab walked out of it into the masthead — and the
  language switch had just put three more controls there to land on. `inert` on
  the deck makes the claim true for the keyboard as well. The switch's buttons
  also carried their language's full name in `title`, which is not the accessible
  name: a button with text takes its name from that text, so "עב" was announced as
  two letters and never as "עברית". `aria-label` now says it.
  The tests: the check that a translation asks for no data the caller lacks ran in
  one direction only, so a phrase that *dropped* a placeholder passed — quieter and
  worse, since the sentence still reads and has merely stopped naming the square.
  It is symmetric now, proved by deleting `{coord}` from the Russian
  `msg.yourShipHit` and watching it go red. And the exhaustive hundred-cell
  coordinate property had drifted onto a copy of the function written in the spec,
  leaving the one that ships exercised at three cells; it runs through `I18n.coord`
  again, in all three alphabets.
  `level.unknown` was found dead — its only caller was the `difficultyName` the
  levels lost — and deleted.
  Coverage now holds `src/app/i18n/**` to the same 95% as the rules. Two branches
  argued back: the language the browser asks for, and the plural category a phrase
  does not spell out. The first was real code hiding behind an untestable
  `navigator`, so it was split into `preferredLang` and `browserLanguages` and
  tested properly. The second turned out to be unreachable, and rather than a test
  for it there is now an invariant — every phrase answers every category its own
  language can produce — verified by dropping Hebrew's dual and watching it go red.
  Build exit 0 without warnings (60.4 kB gzip, up from 55.3 — three dictionaries and
  two Hebrew font families), `npm test -- --run` — 372/372, coverage 95.2% of
  statements / 94.9% of lines against a threshold of 70, domain, opponent and i18n
  all above 95.
- Phase 6, one screen. On a desktop both charts and the rack are meant to be taken
  in at a glance, and they were not: a chart is square and sized by its column, so
  on a wide but short window it ran past the fold. From 1180 px the chart now takes
  the smaller of its column and what is left of the viewport height, and the rack
  scrolls inside itself rather than scrolling the page — a page scrollbar would
  push the second chart out of sight. Verified in a real browser rather than by
  arithmetic, which is how the actual bug surfaced: `margin-inline: auto` cancels a
  flex item's stretch, so with `max-width` alone the chart fell back to its
  intrinsic width and collapsed to zero. It needs a definite `width`. Measured at
  1536 × 706 — no scrollbar in either axis, in English and in Hebrew, deploying and
  in battle.
