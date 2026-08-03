import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { isSunk } from '../domain/fleet';
import { Ship } from '../domain/fleet';
import { CELLS, COL_LABELS, ROW_LABELS, SIZE, coordLabel, colOf, rowOf } from '../domain/grid';
import { Board } from '../domain/board';
import { Splash } from '../core/game-store';
import { ShipGlyph } from './ship-glyph';

export interface Ghost {
  cells: number[];
  valid: boolean;
  size: number;
  orient: 'h' | 'v';
}

const STATE_WORD: Record<string, string> = {
  unknown: 'не пристреляна',
  miss: 'мимо',
  hit: 'попадание',
  sunk: 'потоплен',
};

/** Промеры глубин на бумаге — ровно столько, чтобы карта выглядела рабочей. */
const SOUNDINGS = [
  [8, 14, 42], [26, 31, 27], [47, 12, 55], [63, 44, 18], [12, 68, 36],
  [72, 22, 61], [35, 78, 24], [88, 57, 47], [55, 88, 33], [18, 45, 52],
] as const;

@Component({
  selector: 'app-board-grid',
  imports: [ShipGlyph],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './board-grid.html',
  styleUrl: './board-grid.css',
  host: {
    '[class.is-chart]': "variant() === 'chart'",
    '[class.is-abyss]': "variant() === 'abyss'",
    '[class.is-live]': 'interactive()',
  },
})
export class BoardGrid {
  readonly board = input.required<Board>();
  readonly variant = input.required<'chart' | 'abyss'>();
  readonly interactive = input(false);
  readonly ghost = input<Ghost | null>(null);
  readonly splash = input<Splash | null>(null);
  readonly caption = input('');
  /** По окончании боя чужой квадрат наносится на карту целиком. */
  readonly surveyed = input(false);

  readonly cellEnter = output<number>();
  readonly cellLeave = output<void>();
  readonly cellPick = output<number>();
  readonly rotateRequest = output<void>();

  private readonly cellRefs = viewChildren<ElementRef<HTMLButtonElement>>('cellRef');

  /** Клетки сгруппированы по рядам ради разметки role="row"; сетку это не ломает. */
  protected readonly gridRows = Array.from({ length: SIZE }, (_, r) =>
    Array.from({ length: SIZE }, (_, c) => r * SIZE + c),
  );
  protected readonly rows = ROW_LABELS;
  protected readonly cols = COL_LABELS;
  protected readonly soundings = SOUNDINGS;

  protected readonly focusIdx = signal(0);
  protected readonly hoverIdx = signal<number | null>(null);
  private wantsFocus = false;

  /** На своей карте виден весь флот; в чужих водах — только то, что подтверждено потоплением. */
  protected readonly hulls = computed<Ship[]>(() => {
    const ships = this.board().ships;
    if (this.variant() === 'chart' || this.surveyed()) return ships;
    return ships.filter(isSunk);
  });

  protected readonly ghostCells = computed(() => new Set(this.ghost()?.cells ?? []));

  protected readonly crosshair = computed(() => {
    const h = this.hoverIdx();
    if (h === null || !this.interactive()) return null;
    return { row: rowOf(h), col: colOf(h) };
  });

  /** Всплеск живёт в списке, чтобы каждый новый выстрел пересоздавал анимацию. */
  protected readonly splashes = computed(() => {
    const s = this.splash();
    return s ? [s] : [];
  });

  constructor() {
    effect(() => {
      const i = this.focusIdx();
      if (!this.wantsFocus) return;
      this.wantsFocus = false;
      this.cellRefs()[i]?.nativeElement.focus();
    });
  }

  protected state(i: number): string {
    return this.board().shots[i];
  }

  protected label(i: number): string {
    return `${coordLabel(i)} — ${STATE_WORD[this.state(i)]}`;
  }

  /**
   * Накладки лежат поверх сетки в абсолютных координатах: если раздавать им
   * grid-row/grid-column, автоматическая раскладка сдвигает сами клетки.
   */
  protected shipStyle(ship: Ship, i: number): Record<string, string> {
    const box = patch(ship.row, ship.col, ship.size, ship.orient);
    // финальная съёмка квадрата ложится на бумагу по очереди, корабль за кораблём
    return this.surveyed() ? { ...box, 'animation-delay': `${i * 80}ms` } : box;
  }

  protected glyphStyle(ship: Ship): Record<string, string> {
    return ship.orient === 'v'
      ? { width: `${ship.size * 100}%`, height: `${100 / ship.size}%` }
      : { width: '100%', height: '100%' };
  }

  protected ghostStyle(): Record<string, string> {
    const g = this.ghost();
    if (!g?.cells.length) return {};
    const head = g.cells[0];
    return patch(rowOf(head), colOf(head), g.cells.length, g.orient);
  }

  protected ghostGlyphStyle(): Record<string, string> {
    const g = this.ghost();
    if (!g) return {};
    const n = g.cells.length || 1;
    return g.orient === 'v'
      ? { width: `${n * 100}%`, height: `${100 / n}%` }
      : { width: '100%', height: '100%' };
  }

  protected splashStyle(cell: number): Record<string, string> {
    return patch(rowOf(cell), colOf(cell), 1, 'h');
  }

  protected isCross(i: number): boolean {
    const c = this.crosshair();
    if (!c) return false;
    return rowOf(i) === c.row || colOf(i) === c.col;
  }

  protected onEnter(i: number): void {
    this.hoverIdx.set(i);
    this.cellEnter.emit(i);
  }

  protected onLeave(): void {
    this.hoverIdx.set(null);
    this.cellLeave.emit();
  }

  protected onPick(i: number): void {
    this.cellPick.emit(i);
  }

  protected onContext(event: MouseEvent): void {
    if (!this.interactive()) return;
    event.preventDefault();
    this.rotateRequest.emit();
  }

  /**
   * Стрелки обрабатываются на сетке, а не на клетке: фокус переезжает
   * асинхронно, и быстрые нажатия иначе теряются.
   */
  protected onKey(event: KeyboardEvent): void {
    const deltas: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: SIZE,
      ArrowUp: -SIZE,
    };
    const d = deltas[event.key];
    if (d === undefined) return;
    event.preventDefault();
    const from = this.focusIdx();
    const next = from + d;
    if (next < 0 || next >= CELLS) return;
    if (Math.abs(d) === 1 && rowOf(next) !== rowOf(from)) return;
    this.wantsFocus = true;
    this.focusIdx.set(next);
    this.hoverIdx.set(next);
    this.cellEnter.emit(next);
  }

  protected onFocus(i: number): void {
    this.focusIdx.set(i);
    this.hoverIdx.set(i);
    this.cellEnter.emit(i);
  }
}

/** Прямоугольник на N клеток в процентах от квадрата 10×10. */
function patch(row: number, col: number, size: number, orient: 'h' | 'v'): Record<string, string> {
  return {
    left: `${col * 10}%`,
    top: `${row * 10}%`,
    width: `${(orient === 'h' ? size : 1) * 10}%`,
    height: `${(orient === 'v' ? size : 1) * 10}%`,
  };
}
