import { Board, emptyBoard } from './board';
import { FLEET_SPEC, Ship } from './fleet';
import { Orientation, SIZE, Side, colOf, idx, inBounds, rowOf } from './grid';
import { Rng } from './rng';

/**
 * Расстановка флота.
 *
 * Главное правило русского морского боя: корабли не соприкасаются — ни бортами,
 * ни углами. Отсюда всё остальное: и проверка легальности, и обводка потопленного
 * промахами, и то, почему противник может вычёркивать клетки вокруг находки.
 */

/** Клетки корабля от носа; пустой массив, если он не помещается в квадрат. */
export function shipCells(row: number, col: number, size: number, orient: Orientation): number[] {
  const cells: number[] = [];
  for (let k = 0; k < size; k++) {
    const r = orient === 'v' ? row + k : row;
    const c = orient === 'h' ? col + k : col;
    if (!inBounds(r, c)) return [];
    cells.push(idx(r, c));
  }
  return cells;
}

/** Те же клетки, но обрезанные по краю — для полупрозрачного силуэта под курсором. */
export function clippedCells(
  row: number,
  col: number,
  size: number,
  orient: Orientation,
): number[] {
  const cells: number[] = [];
  for (let k = 0; k < size; k++) {
    const r = orient === 'v' ? row + k : row;
    const c = orient === 'h' ? col + k : col;
    if (inBounds(r, c)) cells.push(idx(r, c));
  }
  return cells;
}

/** Кольцо вокруг корабля, включая диагонали: там не может стоять ничего. */
export function aura(cells: readonly number[]): number[] {
  const own = new Set(cells);
  const ring = new Set<number>();
  for (const c of cells) {
    const r = rowOf(c);
    const k = colOf(c);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dk = -1; dk <= 1; dk++) {
        const nr = r + dr;
        const nk = k + dk;
        if (!inBounds(nr, nk)) continue;
        const n = idx(nr, nk);
        if (!own.has(n)) ring.add(n);
      }
    }
  }
  return [...ring];
}

export function canPlace(
  board: Board,
  row: number,
  col: number,
  size: number,
  orient: Orientation,
): boolean {
  const cells = shipCells(row, col, size, orient);
  if (!cells.length) return false;
  if (cells.some((c) => board.shipAt[c] !== -1)) return false;
  return !aura(cells).some((c) => board.shipAt[c] !== -1);
}

export function withShip(
  board: Board,
  row: number,
  col: number,
  size: number,
  orient: Orientation,
): Board {
  const cells = shipCells(row, col, size, orient);
  const id = board.ships.length ? Math.max(...board.ships.map((s) => s.id)) + 1 : 0;
  const ship: Ship = { id, size, row, col, orient, cells, hits: 0 };
  const shipAt = board.shipAt.slice();
  for (const c of cells) shipAt[c] = id;
  return { ...board, ships: [...board.ships, ship], shipAt };
}

export function withoutShipAt(board: Board, cell: number): Board {
  const id = board.shipAt[cell];
  if (id === -1) return board;
  const ship = board.ships.find((s) => s.id === id);
  if (!ship) return board;
  const shipAt = board.shipAt.slice();
  for (const c of ship.cells) shipAt[c] = -1;
  return { ...board, ships: board.ships.filter((s) => s.id !== id), shipAt };
}

/** Все легальные постановки корабля данного калибра на текущем поле. */
export function legalSpots(board: Board, size: number): Array<[number, number, Orientation]> {
  const spots: Array<[number, number, Orientation]> = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (canPlace(board, r, c, size, 'h')) spots.push([r, c, 'h']);
      // однопалубный вертикально — тот же самый корабль, второй раз его не предлагаем
      if (size > 1 && canPlace(board, r, c, size, 'v')) spots.push([r, c, 'v']);
    }
  }
  return spots;
}

/**
 * Случайная, но всегда легальная расстановка: крупные корабли ставятся первыми,
 * иначе мелочь дробит поле и линкору не остаётся прямой.
 *
 * `attempts` — сколько раз перекладывать флот, если жребий загнал себя в тупик.
 * На пустом поле 10×10 при постановке от крупного к мелкому тупик практически
 * недостижим, но запас нужен, а с нулём запаса видно, что делает запасной путь.
 */
export function randomBoard(rng: Rng, owner: Side, attempts = 300): Board {
  attempt: for (let tries = 0; tries < attempts; tries++) {
    let board = emptyBoard(owner);
    for (const spec of FLEET_SPEC) {
      for (let n = 0; n < spec.count; n++) {
        const spots = legalSpots(board, spec.size);
        if (!spots.length) continue attempt;
        const [r, c, o] = rng.pick(spots);
        board = withShip(board, r, c, spec.size, o);
      }
    }
    return board;
  }
  return canonicalBoard(owner);
}

/**
 * Запасная расстановка на случай, если жребий 300 раз загонит себя в тупик.
 * Пустая доска здесь не годится: флот из нуля кораблей нельзя потопить.
 */
const CANONICAL: ReadonlyArray<[number, number, number, Orientation]> = [
  [0, 0, 4, 'h'],
  [0, 5, 3, 'h'],
  [2, 0, 3, 'h'],
  [2, 4, 2, 'h'],
  [2, 7, 2, 'h'],
  [4, 0, 2, 'h'],
  [4, 3, 1, 'h'],
  [4, 5, 1, 'h'],
  [4, 7, 1, 'h'],
  [4, 9, 1, 'h'],
];

export function canonicalBoard(owner: Side): Board {
  let board = emptyBoard(owner);
  for (const [r, c, size, o] of CANONICAL) board = withShip(board, r, c, size, o);
  return board;
}
