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
- [x] Self-hosted fonts: no request leaves this origin any more
- [x] Turn a ship that is already on the chart, with the gesture that already turns things
- [x] A harder opponent — found on the mooring side, not the shooting side
- [x] ~~Show the Admiral's reckoning after the battle, washed onto your own chart~~ —
      built, then taken back out again in phase 7
- [x] A mirror on the result card: what the Admiral would have needed
- [x] The chart inks itself in on the first frame
- [x] Phase 6 gate: the whole suite + the production build + `npm run test:sim`,
      coverage held to 95% on `src/app/i18n/**` as well

## Phase 7 — taking things back out

- [x] Remove the replay of the Admiral's reckoning: it confused more than it told
- [x] Bring the code up to the v22 conventions the CLI's MCP server states
- [x] Audit the vitest rig against v22, write `TESTING.md` and a `writing-tests` skill

## Open items (next pass)

All the phases are closed, the gates are green. Below is what was deliberately
put off.

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
- Phase 6, the fonts came home. They were the last thing the game asked of anybody
  else: five families from fonts.googleapis.com, which put a DNS lookup and a TLS
  handshake to two other hosts in front of the first paint, and a record of every
  visit on a server that is not ours. The same woff2 files now sit in
  `public/fonts` and are declared in `src/fonts.css`.
  Seventeen files and 302 kB sounds worse than it is: each face is declared once
  per subset with the `unicode-range` it covers, so a browser fetches only the
  alphabet the page is in — about 153 kB of Latin for an English visitor, 54 kB of
  Hebrew plus the digits for a Hebrew one. Nobody pays for all three. Only the two
  faces the first paint cannot do without are preloaded, and only their Latin cut.
  A guard holds the line, because pasting a `<link>` from a font site is a thing
  one does without noticing: no stylesheet and no `<link>` may name a font host,
  every declared file must exist, every shipped file must be declared, every face
  must carry a `unicode-range` and `font-display: swap`. Verified by putting a
  Google Fonts link back and watching it go red. The OFL text ships beside the
  files, as that licence requires.
  Build exit 0 (60.7 kB gzip of JS and CSS, plus the fonts as separate cached
  files), `npm test -- --run` — 381/381.
- Phase 6, turning a ship already down. Asked for as drag-and-drop deployment, and
  a working prototype of that is what settled it: pressing on the roster means the
  drag vector is enormously horizontal before the pointer is anywhere near the
  chart, so measuring orientation from the press point lays every ship flat.
  Anchoring the measurement at the moment the pointer crosses onto the chart fixes
  the arithmetic and not the feel — moving the ship and choosing its orientation
  stay the same gesture, so it keeps flipping under your hand. Shown, tried,
  rejected, and the requirement turned into the thing actually wanted: put a ship
  down, then turn it.
  Right-click already turned the ship waiting to be placed, so now it turns
  whatever is under the pointer — a ship already standing, or else the pending one.
  One gesture, one meaning, nothing new to learn. The cell has to travel with the
  request, so `rotateRequest` carries it and reports -1 for a click that lands in
  the hairline between squares.
  It pivots on the bow and is pulled back onto the board if turning would take the
  stern over the edge; if a neighbour is too close it does not move and the rail
  says why, rather than the ship silently refusing. Both of those are guards, and
  both were watched going red — dropping the clamp and dropping the legality check
  each fails its own test and nothing else.
  Build exit 0, `npm test -- --run` — 388/388, and the gesture driven in a real
  browser: the four-decker turns on its bow, and with a boat two squares away it
  refuses and explains.
- Phase 6, a harder opponent. Asked for as a level above the Admiral, on the
  reasoning that his density map counts each surviving ship on its own and never
  checks that they could all be on the board at once. The reasoning is sound and
  the level was built: deal whole legal fleets consistent with every mark, count
  how often each square is occupied, fire at the commonest. It lost. Three
  goes at it — fixing a real weighting bug where two cruisers counted as one,
  raising the deals from 160 to 600, adding the Midshipman's lattice to the hunt,
  aiming the kill by "does this square belong to the ship I have already hit"
  rather than by bare occupancy — and the best of them came in at 55.34 against
  the Admiral's 55.16 over five hundred games. A 200-game run had it 0.15 ahead
  at one point, which is exactly the sort of margin that is worth nothing.
  Reading up settled why: the exact density map *is* the published state of the
  art for this game, around 42 salvos against 64 for parity with hunt-and-target
  on the fleet those articles use. Monte Carlo replaces an exact count of a
  slightly wrong quantity with a noisy count of the right one, and on a hundred
  squares the noise is larger than the difference it was meant to reveal. The
  sampler is deleted; this paragraph is what is left of it, so that nobody
  rebuilds it expecting a different answer.
  The gain was on the other side of the board entirely, and it was the player who
  pointed at it: how the opponent moors its own fleet. An even draw is not
  neutral — the no-touching rule leaves far more room in the middle than at the
  edges, so a uniform draw crowds the ships into the centre, which is exactly
  where a density hunter looks first. The fleet was mooring itself where it was
  easiest to find. Now a dozen legal fleets are dealt and the one lying in the
  coldest water goes to sea. Best-of-a-dozen and not the coldest obtainable, on
  purpose: squeezed harder every game would open with the same edges and corners,
  and a habit is worth more to an opponent than a good average.
  Paired against the same layouts, that is worth **+3.59 ± 0.93 salvos at 7.8σ** —
  more than the whole gap between Midshipman and Admiral, which is 2.2. The
  simulation now reports paired margins in standard errors, because "0.15 better"
  and "3.59 better" needed telling apart and the mean alone would not do it.
  The player's own draw uses the same mooring: whoever asks for one should not be
  handed a worse deployment than the computer keeps for itself.
  Build exit 0, `npm test -- --run` — 397/397, coverage 95.4% of statements,
  `npm run test:sim` — Admiral 54.91 < Midshipman 57.13 < Cabin Boy 63.19.
- Phase 6, what the Admiral saw. The opponent already works out, before each of
  his salvos, how likely a ship is on every square — and then throws it away. It
  is now kept, a hundred numbers a turn, and washed onto the paper afterwards
  with a scrubber to walk the battle back through.
  Prototyped first, and the prototype earned its keep twice. It caught a `return`
  where a `continue` belonged inside a `forEach` — every ship after the first
  found no berth and the whole thing fell over, which is what happens when a
  prototype is published without being run. It also caught the design mistake:
  scaled from zero the wash floods the chart one flat colour, because early on
  every square really is worth about the same. Stretched between the coldest and
  the warmest square still in play, the corners sit on bare paper and the ramp
  carries meaning. Six bands rather than a smooth gradient, the way a chart
  shades depth — a maximum can be picked out of bands and blurs in a gradient.
  Two things it will not do. It is shown only after the battle, over a chart the
  player already knows: during play it would be pointing at their own ships and
  telling them what the opponent is about to do. And it is kept only for the
  Admiral, because he is the only level that computes one — a map over the Cabin
  Boy's random shots would be an invention.
  The moment worth building it for is the collapse: hunting, ninety-six squares
  carry some ink; the salvo after a hit lands, one does. The twenty-four-fold
  weight on a berth covering an open hit, made visible.
  Two things it broke, both caught in the browser rather than by tests. The rack
  gained a second scrollbar beside the firing log's — one scroll region per phase
  now, the log taking the slack in battle and the rack itself scrolling during
  deployment. And the replay bar is height the one-screen fit knew nothing about,
  so the charts ran past the fold; `--deck-chrome` rises while it is open and
  both charts shrink together, since a mismatched pair reads as a mistake.
  Build exit 0, `npm test -- --run` — 411/411, coverage 95.1% of statements.
- Phase 6, two small ones. A number on the result card and a second and a
  quarter of theatre at the start.
  The mirror: sixty-one salvos means nothing on its own, and the game already
  holds a very strong shooter, so it is simply set on the same deployment and
  counted. Same ships, same squares, no luck of the draw between the two figures.
  It replays from a board rebuilt out of the ships' positions and runs off a seed
  of its own, because doing it on the game's own randomness would draw thousands
  of numbers from it and the next battle would deal a different board for having
  been asked a question. Shown only after a win — after a defeat the square was
  never cleared and there is nothing to hold the number against.
  Two of its tests were worthless before they were mutated. Comparing the levels
  on the canonical board over twelve seeds had the Cabin Boy *ahead*, so it now
  runs over twenty-five varied deployments. And "asking twice gives the same
  answer" cannot fail at all: `computed` memoises, so the second read never runs.
  Killing the seed isolation left the suite green. The replacement compares a
  game that was asked against one that was not, and goes red for the right reason.
  The chart drawing itself: contours wiped across, soundings written in after
  them, the compass rose settling to north last. The wipe is a clip and not a
  stroke-dashoffset, because those contours are dashed and animating the offset
  would draw them solid and then snap. Everything fills `both`, so under
  `prefers-reduced-motion`, where the global rule cuts every duration to nothing,
  the chart simply starts finished.
  Build exit 0, `npm test -- --run` — 419/419, coverage 95.1% of statements,
  `npm run test:sim` green with the mooring still worth +3.38 ± 0.83 at 8.1σ.
- Phase 7, item 1: the replay of the Admiral's reckoning is gone. It read as a
  puzzle rather than an explanation — a chart of shifting ink with a scrub bar
  under it, shown at the one moment the player has already stopped caring where
  the ships were. Out went the `Reckoning` frames and the whole replay state from
  the store, the bar above the home chart, the `heat`/`asOf` inputs and the
  banded wash on `board-grid`, the button on the result card, the `replay.*` keys
  in all three dictionaries, and the CSS of all three. `ai/density.ts` stays
  untouched: the Admiral still computes a map before every salvo, he simply no
  longer keeps it — one call and a hundred numbers a turn less. The mirror on the
  result card stays too; it answers a question the player actually asked.
  Build exit 0 with no warnings, `npm test -- --run` — 406/406 (13 tests removed
  with the feature), coverage 95.39% of statements / 95.14% of branches,
  `npm run test:sim` green: Admiral 55.16 < Midshipman 57.05 < Cabin Boy 63.10,
  the mooring still worth +3.38 ± 0.83 at 8.1σ.
- Phase 7, item 2: the Angular CLI's MCP server is rigged for this workspace, and
  it answers for the version actually installed rather than for whatever was true
  when a habit was formed. Asked, it named two things we were behind on, and both
  are now closed. `changeDetection: ChangeDetectionStrategy.OnPush` came out of
  all seven components: OnPush is the strategy from v22 whether it is written or
  not, so the line said nothing — angular.dev states it outright, and the DOM
  tests agree, unchanged and green. The three services moved from
  `@Injectable({ providedIn: 'root' })` to `@Service()`; the decorator is public
  API in the installed 22.1.0 and `autoProvided` defaults to true, which is the
  same rooting spelled shorter. Everything else the guide asks for was already
  the house style — standalone without `standalone: true`, `input()`/`output()`,
  host bindings in the decorator's `host`, native control flow, class and style
  bindings, `inject()`, no `any`.
  Build exit 0 with no warnings, `npm test -- --run` — 406/406, coverage gate
  green at 95.38% of statements / 95.14% of branches. `npm run test:sim` not run:
  nothing under `ai/` moved, and neither did the store's use of it.
- Phase 7, item 3: the test rig audited against what Angular v22 actually
  prescribes, and the findings written down rather than remembered. The rig
  itself was already the standard one — `@angular/build:unit-test` with vitest in
  jsdom, `runnerConfig` a documented option — so nothing structural moved. Four
  things did.
  `TestBed.resetTestingModule()` came out of eleven `beforeEach` blocks: the
  builder registers `beforeEach(getCleanupHook(false))` / `afterEach(getCleanupHook(true))`
  and that hook resets the TestBed itself. Proven with a throwaway spec whose two
  tests each configure the module from scratch — without a reset between them the
  second would throw. The three resets that sit *inside* a test stayed: that is
  how a test builds a second injector to compare against the first.
  A global setup file, `src/test-setup.ts`, declared as `setupFiles` on the test
  target — the builder overwrites the runner's own `setupFiles`, so the vitest
  config is the wrong place for it. It sweeps what the TestBed reset never
  touches: `localStorage` and the `lang`/`dir` the i18n effect stamps on `<html>`.
  The per-file copies of that cleanup are gone. Seen red as the rules demand:
  disarm the hook and four spec files fail on language leaking between tests.
  `vitest/globals` left `tsconfig.spec.json` — all 22 specs import `describe`/`it`
  by name, and dropping the ambient types makes an accidental global fail to
  compile. A dead `src/testing/**` came out of `coverageExclude`.
  What did *not* change: `fixture.detectChanges()`. Angular prefers
  `await fixture.whenStable()`, and says converting an existing suite is likely
  not worth it — but there is a harder reason, measured rather than assumed:
  under `vi.useFakeTimers()` `whenStable()` never resolves and dies on the 15 s
  timeout, while the same component settles in ~50 ms on real timers. Most
  component specs here run on fake timers because the store lives on `PAUSE`.
  That, and everything else worth knowing, is now in `TESTING.md`, with a
  `writing-tests` skill carrying the short form to whoever touches a spec.
  Build exit 0 with no warnings, `npm test -- --run` — 406/406, coverage gate
  green at 95.38% of statements / 95.14% of branches. `npm run test:sim` not run:
  nothing under `ai/` moved.
