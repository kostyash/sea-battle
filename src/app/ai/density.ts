import { CellState } from '../domain/board';
import { CELLS, SIZE, colOf, idx, inBounds, rowOf } from '../domain/grid';
import { Rng } from '../domain/rng';

/**
 * Адмирал: карта плотности.
 *
 * Для каждого уцелевшего калибра перебираются все его постановки, совместимые с
 * отметками на поле, и каждая клетка набирает вес по числу проходящих через неё
 * расстановок. Бить надо туда, где кораблю негде спрятаться.
 *
 * Добивание отдельным режимом не нужно: постановка, накрывающая раненую клетку,
 * получает вес на порядок выше, и максимум сам уезжает к недобитому кораблю.
 */

/** Во сколько раз ценнее постановка за каждую накрытую раненую клетку. */
const WOUND_WEIGHT = 24;

export function densityMap(
  shots: readonly CellState[],
  afloat: readonly number[],
): { score: number[]; mustFinish: boolean } {
  const wounded = shots.some((s) => s === 'hit');
  const score = new Array<number>(CELLS).fill(0);

  const byCalibre = new Map<number, number>();
  for (const size of afloat) byCalibre.set(size, (byCalibre.get(size) ?? 0) + 1);

  for (const [size, count] of byCalibre) {
    // однопалубный «вертикально» — тот же самый корабль, второй раз не считаем
    const orients: ReadonlyArray<readonly [number, number]> =
      size === 1 ? [[0, 1]] : [
        [0, 1],
        [1, 0],
      ];

    for (const [dr, dc] of orients) {
      const rows = dr ? SIZE - size + 1 : SIZE;
      const cols = dc ? SIZE - size + 1 : SIZE;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const span: number[] = [];
          for (let k = 0; k < size; k++) span.push(idx(r + dr * k, c + dc * k));

          if (span.some((i) => shots[i] === 'miss' || shots[i] === 'sunk')) continue;
          // корабли не соприкасаются: встать вплотную к чужой ране нельзя
          if (touchesForeignHit(shots, span)) continue;

          const covered = span.filter((i) => shots[i] === 'hit').length;
          if (wounded && covered === 0) continue;

          const weight = count * Math.pow(WOUND_WEIGHT, covered);
          for (const i of span) if (shots[i] === 'unknown') score[i] += weight;
        }
      }
    }
  }

  return { score, mustFinish: wounded };
}

/**
 * Клетка с наибольшей плотностью, либо -1, если ни одна расстановка не сошлась
 * (тогда решает вызывающий — падать в мичманский поиск).
 */
export function densityShot(
  shots: readonly CellState[],
  afloat: readonly number[],
  open: readonly number[],
  rng: Rng,
): number {
  const { score } = densityMap(shots, afloat);

  let top = 0;
  const ties: number[] = [];
  for (const i of open) {
    if (score[i] > top) {
      top = score[i];
      ties.length = 0;
      ties.push(i);
    } else if (score[i] === top && top > 0) {
      ties.push(i);
    }
  }

  return ties.length ? rng.pick(ties) : -1;
}

/** Есть ли рядом с предполагаемым корпусом раненая клетка, которую он не покрывает. */
export function touchesForeignHit(shots: readonly CellState[], span: readonly number[]): boolean {
  const own = new Set(span);
  for (const c of span) {
    const r = rowOf(c);
    const k = colOf(c);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dk = -1; dk <= 1; dk++) {
        const nr = r + dr;
        const nk = k + dk;
        if (!inBounds(nr, nk)) continue;
        const n = idx(nr, nk);
        if (!own.has(n) && shots[n] === 'hit') return true;
      }
    }
  }
  return false;
}
