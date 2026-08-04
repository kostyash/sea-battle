import { emptyBoard } from '../domain/board';
import { Ship } from '../domain/fleet';
import { CELLS } from '../domain/grid';
import { withShip } from '../domain/placement';
import { Rng } from '../domain/rng';
import { afloatSizes, fire, isFleetDestroyed } from '../domain/shot';
import { Difficulty } from './levels';
import { chooseShot } from './opponent';

/**
 * How many salvos the opponent would have needed against this very fleet.
 *
 * A player finishing in sixty-one salvos has no idea whether that is good. The
 * game already contains a very strong shooter, so it can simply be asked: set it
 * on the same deployment and count. Same ships, same squares, no luck of the
 * draw between the two numbers — which is what makes it a fair mirror rather
 * than a boast.
 *
 * It replays from an empty board built out of the ships' positions, so nothing
 * of the real game is touched.
 */
export function salvosToClear(
  ships: readonly Ship[],
  rng: Rng,
  level: Difficulty = 'admiral',
): number {
  let board = emptyBoard('enemy');
  for (const ship of ships) {
    board = withShip(board, ship.row, ship.col, ship.size, ship.orient);
  }

  let salvos = 0;
  // a fleet of twenty decks cannot outlast the hundred squares holding it
  while (!isFleetDestroyed(board) && salvos < CELLS) {
    const cell = chooseShot(board.shots, afloatSizes(board), level, rng);
    if (cell === -1) break;
    board = fire(board, cell).board;
    salvos++;
  }

  return salvos;
}
