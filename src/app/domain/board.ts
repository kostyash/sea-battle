import { Ship } from './fleet';
import { CELLS, Side } from './grid';

/** What the shooter knows about a cell. `unknown` — nobody has fired at it yet. */
export type CellState = 'unknown' | 'miss' | 'hit' | 'sunk';

/** How the salvo ended. */
export type ShotResult = 'miss' | 'hit' | 'sunk';

export interface Board {
  owner: Side;
  ships: Ship[];
  /**
   * cell index → ship id, or -1.
   * The id is not a position in `ships`: removing a ship does not shift the
   * numbers, so always look one up via `ships.find(s => s.id === …)`.
   */
  shipAt: number[];
  /** cell index → what the shooter knows about it */
  shots: CellState[];
}

export function emptyBoard(owner: Side): Board {
  return {
    owner,
    ships: [],
    shipAt: new Array<number>(CELLS).fill(-1),
    shots: new Array<CellState>(CELLS).fill('unknown'),
  };
}
