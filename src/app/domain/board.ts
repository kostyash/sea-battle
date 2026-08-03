import { Ship } from './fleet';
import { CELLS, Side } from './grid';

/** Что стреляющий знает о клетке. `unknown` — по ней ещё не били. */
export type CellState = 'unknown' | 'miss' | 'hit' | 'sunk';

/** Чем закончился залп. */
export type ShotResult = 'miss' | 'hit' | 'sunk';

export interface Board {
  owner: Side;
  ships: Ship[];
  /**
   * индекс клетки → id корабля, либо -1.
   * id — не позиция в `ships`: после снятия корабля номера не сдвигаются,
   * поэтому искать всегда через `ships.find(s => s.id === …)`.
   */
  shipAt: number[];
  /** индекс клетки → что о ней известно стреляющему */
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
