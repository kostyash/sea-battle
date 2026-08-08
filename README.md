# Sea Battle

Classic sea battle against the computer. Angular 22, standalone components,
signals, zoneless change detection, no third-party dependencies.

```bash
npm start          # http://localhost:4200
npm run build      # production build, ~55 kB gzip
```

## Rules

A 10×10 field, rows A…J, columns 1…10. The fleet: one battleship (4 decks), two
cruisers (3), three destroyers (2), four patrol boats (1) — ten ships and twenty
decks in all.

- Ships never touch, not even at the corners.
- Hit — you fire again. Miss — the turn passes.
- A sunk ship rings itself with misses: there can be no ships there.

## Deployment

Pick a ship from the fleet roster, hover over your own chart, click.
`R` or the right mouse button turns it — and turns a ship already standing on the
chart just as readily, pivoting on its bow. Clicking a placed ship takes it back
off. The random-draw button deploys the whole fleet at once.

The arrow keys walk the crosshair across the cells, `Enter` fires.

On a touch screen there is no second button, so a finger **held** on a square does
the same thing: half a second, and whatever is under it turns. A press that starts
to wander is a scroll and is left alone. The panel says as much — the instruction
is written twice and the input decides which wording you get.

## On a phone

The square is the same square; what changes is what is on screen when. While you
are deploying, the opponent's water is empty and can do nothing for you, so it
waits below the fold and the fleet roster comes straight after your own chart.
Press *to battle* and the page brings the opponent's square up itself. The brass
status line — whose move it is, what the last salvo did — pins to the top of the
screen, because scrolled down to a chart you would otherwise be firing blind.

`npm run shots` walks the whole game at four phone widths and leaves the pictures
in `e2e/shots/`; it is run by hand when the layout is touched, not in CI.

## Opponent

| Level | How it thinks |
| --- | --- |
| Cabin Boy | Fires blind, finishes off a wounded ship about half the time |
| Midshipman | Searches every other cell; when finishing off, follows the line it has found |
| Admiral | Builds a density map: enumerates every deployment of the surviving calibres compatible with the marks on the field, and fires at the most likely cell |

The opponent sees only what you see: the grid of marks and the list of ship sizes
not yet sunk. It never peeks at your deployment — see `chooseShot` in
`src/app/ai/opponent.ts`, which is passed only `shots` and the sizes of the surviving ships.

It also thinks about where to moor its own fleet. Drawing a legal deployment at
random is not neutral: the no-touching rule leaves far more room in the middle of
the square than along the edges, so an even draw crowds the ships into the centre
— exactly where a density-counting hunter looks first. Instead a dozen fleets are
dealt and the one lying in the coldest water puts to sea, which is worth about
3.6 extra salvos against that hunter: more than the gap between two difficulty
levels. Your own draw-lots button uses the same mooring.

## Was that any good?

Win, and the result card says what the Admiral would have needed against the very
fleet you just cleared — same ships, same squares. Sixty-one salvos means nothing
on its own; sixty-one against his fifty-four means something.

## Languages

English, Russian and Hebrew, switched at runtime from the button in the masthead;
the choice is remembered in `localStorage`. Hebrew flips the page to `dir="rtl"`.

The board itself deliberately stays left-to-right in every language: its hulls,
silhouettes and splashes are positioned by `left: %` from cell 0, and the arrow
keys walk the same index order — mirroring the square would break both, and a
squared paper chart has no reading direction to respect.

Row letters follow the language: A…J, А…К, א…י. Because of that they are not part
of the rules — `src/app/domain` only ever knows a cell as a number 0…99, and the
store keeps its status line and its firing log as keys plus data rather than as
finished sentences, so switching language mid-battle re-reads what has happened
so far instead of stranding it in the old one.

## How it is put together

```
src/app/domain/   grid.ts      the 10×10 square and cell addressing
                  fleet.ts     the fleet roster and a placed ship
                  placement.ts deployment: legality, the ring with its diagonals
                  shot.ts      resolving a shot, ringing a sunk ship
                  rng.ts       seeded randomness behind an Rng interface
src/app/ai/       levels.ts    the three level ids
                  opponent.ts  Cabin Boy and Midshipman
                  density.ts   the Admiral's density map
src/app/i18n/     en.ts, ru.ts, he.ts   the dictionaries; English defines the keys
                  lang.ts      languages, direction, row letters
                  i18n.ts      the service: t(), plurals, coord(), lang and dir
src/app/core/     game-store.ts  signal state of the game and the turn order
                  audio.ts     all sound is synthesised on WebAudio, not a single file
src/app/ui/       board-grid   a 10×10 square in two materials
                  ship-glyph   ship silhouette drawn from the number of decks
                  deploy-panel, battle-panel, result-overlay, lang-switch
```

The battle logic lives in the pure functions of `src/app/domain` — the board state
is always replaced wholesale, so signals and `OnPush` work without extra contrivances.

## Look and feel

Your own waters are drawn on a chart: paper, Prussian ink, depth soundings, a
compass rose. The enemy square has been surveyed by no one — black water under
the sonar beam. A sunk enemy ship is inked onto that blackness: confirmed
intelligence goes on the chart. After the battle the square is drawn in
completely — you can see where the ships you never found were hiding.

Fonts: Forum (headings), PT Sans Narrow (labels), IBM Plex Mono (coordinates and
the log). None of the three carries Hebrew, so Frank Ruhl Libre and Heebo sit
behind them and the browser falls back per glyph. All five are served from this
origin out of `public/fonts` — the game makes no third-party request at all — and
each is declared per subset, so a browser downloads only the alphabet the page is
actually in. Animations switch off under `prefers-reduced-motion`.
