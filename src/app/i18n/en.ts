import { Phrase } from './phrase';

/**
 * English is the source of truth: its keys define the contract, and `Dictionary`
 * forces every other language to answer all of them. A missing Russian or Hebrew
 * phrase is a compile error, not a blank spot on the screen.
 */
export const EN = {
  /* ── chrome ─────────────────────────────────────────────────────────── */

  'app.eyebrow': 'Training range · 10 × 10 square',
  'app.title': 'Sea Battle',
  'lang.group': 'Language',
  'audio.on': 'Sound on',
  'audio.off': 'Sound off',
  'action.newGame': 'New battle',
  'action.showResult': 'Show result',

  'turn.deploy': 'Deployment',
  'turn.over': 'Battle over',
  'turn.yours': 'Your move',
  'turn.theirs': "Opponent's move",

  /* ── the two seas ───────────────────────────────────────────────────── */

  'sea.home': 'Your waters',
  'sea.home.note': 'charted',
  'sea.away': "Opponent's square",
  'sea.away.done': 'square fully charted',
  'sea.away.progress': '{n} of 10 charted',
  'board.home': 'Your square',
  'board.away': "Opponent's square",

  'cell.unknown': 'not fired at',
  'cell.miss': 'miss',
  'cell.hit': 'hit',
  'cell.sunk': 'sunk',
  'cell.label': '{coord} — {text}',

  /* ── the fleet ──────────────────────────────────────────────────────── */

  'ship.1': 'Patrol boat',
  'ship.2': 'Destroyer',
  'ship.3': 'Cruiser',
  'ship.4': 'Battleship',
  'ship.any': 'Ship',

  /* ── deployment ─────────────────────────────────────────────────────── */

  'fleet.title': 'Fleet roster',
  'fleet.decks': { one: '{n} deck', other: '{n} decks' },
  'orient.h': 'Horizontal',
  'orient.v': 'Vertical',
  'action.autoPlace': 'Draw lots',
  'action.clear': 'Clear',
  'deploy.hint':
    'Pick a ship, move the pointer over your own chart and click. The right mouse button or R turns it — ' +
    'a ship already on the chart just as readily as the one you are about to place. Clicking a placed ship ' +
    'takes it back off. Ships may not touch, not even at the corners.',
  'deploy.remaining': { one: '{n} ship left to place', other: '{n} ships left to place' },
  'action.toBattle': 'To battle',

  'opponent.title': 'Opponent',
  'level.cabin-boy.name': 'Cabin Boy',
  'level.cabin-boy.hint': 'Fires at random, does not always finish the job',
  'level.midshipman.name': 'Midshipman',
  'level.midshipman.hint': 'Searches every other cell, finishes the job',
  'level.admiral.name': 'Admiral',
  'level.admiral.hint': 'Counts the odds across the whole board',

  /* ── battle ─────────────────────────────────────────────────────────── */

  'battle.report': 'Report',
  'battle.yourFleet': 'Your fleet',
  'battle.decksAfloat': { one: 'deck afloat', other: 'decks afloat' },
  'stats.shots': 'Salvos',
  'stats.hits': 'Hits',
  'stats.accuracy': 'Accuracy',
  'stats.sunk': 'Sunk',
  'stats.lost': 'Lost',

  'battle.log': 'Firing log',
  'battle.logEmpty': "Not one salvo yet. Aim at the opponent's square and fire.",
  'log.us': 'US',
  'log.them': 'THEM',
  'log.miss': 'miss',
  'log.hit': 'hit',
  'log.sunk': '{ship} sunk',

  /* ── the result card ────────────────────────────────────────────────── */

  'result.wonEyebrow': 'Square cleared',
  'result.lostEyebrow': 'Square lost',
  'result.won': 'Victory',
  'result.lost': 'Defeat',
  'result.against': 'Opponent — {text}',
  'action.rematch': 'Another battle',
  'action.redeploy': 'Deploy again',
  'replay.open': 'What the Admiral saw',
  'replay.title': 'His reckoning',
  'replay.salvo': 'Salvo',
  'replay.hint': 'The darker the water, the likelier he thought a ship was in it.',
  'replay.close': 'Done',
  'action.survey': "Survey the opponent's square",

  /* ── the status line ────────────────────────────────────────────────── */

  'msg.deploy': 'Deploy your fleet in your own waters',
  'msg.shipRemoved': '{ship} taken off the chart',
  'msg.pickFirst': 'Pick a ship from the roster first',
  'msg.allPlaced': 'Every {ship_lc} is already on the chart',
  'msg.turned': '{ship} turned',
  'msg.noTurn': 'It cannot turn here: ships may not touch, not even at the corners',
  'msg.noRoom': 'It will not fit here: ships may not touch, not even at the corners',
  'msg.fleetReady': 'Fleet in position. To battle!',
  'msg.keepPlacing': 'Carry on with the deployment',
  'msg.autoPlaced': 'Fleet deployed by lot. You can still change it — click a ship.',
  'msg.cleared': 'The chart is clear. Begin again.',
  'msg.yourSalvo': 'Your salvo. Call the square.',
  'msg.miss': 'Missed. The opponent takes aim.',
  'msg.enemySunk': "The opponent's {ship_lc} is sunk. Fire again!",
  'msg.hit': 'A hit! Fire again.',
  'msg.enemyStuck': 'The opponent has nowhere left to fire. Your move.',
  'msg.yourShipSunk': '{coord} — your {ship_lc} is sunk',
  'msg.yourShipHit': '{coord} — a hit on your ship',
  'msg.enemyMiss': 'The opponent fires at {coord} — a miss. Your move.',
  'msg.won': "The opponent's squadron is destroyed",
  'msg.lost': 'Your fleet lies on the bottom',
} as const satisfies Record<string, Phrase>;

export type MsgKey = keyof typeof EN;

/** Every language answers exactly the keys English defines. */
export type Dictionary = Record<MsgKey, Phrase>;
