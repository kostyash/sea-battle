import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { isSunk } from '../domain/fleet';
import { Ship } from '../domain/fleet';
import { CELLS, SIZE, colOf, rowOf } from '../domain/grid';
import { Board } from '../domain/board';
import { Splash } from '../core/game-store';
import { I18n } from '../i18n/i18n';
import { MsgKey } from '../i18n/en';
import { ShipGlyph } from './ship-glyph';

export interface Ghost {
  cells: number[];
  valid: boolean;
  size: number;
  orient: 'h' | 'v';
}

const STATE_KEY: Record<string, MsgKey> = {
  unknown: 'cell.unknown',
  miss: 'cell.miss',
  hit: 'cell.hit',
  sunk: 'cell.sunk',
};

/** Depth soundings on the paper — just enough of them to make the chart look worked. */
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
  protected readonly i18n = inject(I18n);

  readonly board = input.required<Board>();
  readonly variant = input.required<'chart' | 'abyss'>();
  readonly interactive = input(false);
  readonly ghost = input<Ghost | null>(null);
  readonly splash = input<Splash | null>(null);
  readonly caption = input('');
  /** Once the battle is over the opponent's square is charted in full. */
  readonly surveyed = input(false);

  readonly cellEnter = output<number>();
  readonly cellLeave = output<void>();
  readonly cellPick = output<number>();
  readonly rotateRequest = output<void>();

  private readonly cellRefs = viewChildren<ElementRef<HTMLButtonElement>>('cellRef');

  /** Cells are grouped into rows for the role="row" markup; the grid survives it. */
  protected readonly gridRows = Array.from({ length: SIZE }, (_, r) =>
    Array.from({ length: SIZE }, (_, c) => r * SIZE + c),
  );
  protected readonly rows = this.i18n.rowLabels;
  protected readonly cols = this.i18n.colLabels;
  protected readonly soundings = SOUNDINGS;

  protected readonly focusIdx = signal(0);
  protected readonly hoverIdx = signal<number | null>(null);
  private wantsFocus = false;

  /** Your own chart shows the whole fleet; in foreign waters, only what sinking confirmed. */
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

  /** The splash lives in a list so that every new shot recreates the animation. */
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
    return this.i18n.t('cell.label', { cell: i, text: this.i18n.t(STATE_KEY[this.state(i)]) });
  }

  /**
   * The overlays sit on top of the grid in absolute coordinates: hand them
   * grid-row/grid-column instead and the auto layout shifts the cells themselves.
   */
  protected shipStyle(ship: Ship, i: number): Record<string, string> {
    const box = patch(ship.row, ship.col, ship.size, ship.orient);
    // the final survey of the square settles onto the paper in turn, ship after ship
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
    if (!this.interactive()) return;
    this.hoverIdx.set(i);
    this.cellEnter.emit(i);
  }

  protected onLeave(): void {
    this.hoverIdx.set(null);
    this.cellLeave.emit();
  }

  /** Focus left the grid — put out the crosshair, or it burns with nothing aimed. */
  protected onBlur(): void {
    this.hoverIdx.set(null);
  }

  /**
   * Cells are never marked `disabled`: the browser pulls focus off a disabled
   * button, and after every shot the keyboard aim flew off to the body. Instead
   * the cell stays focusable and the action is smothered here.
   */
  protected onPick(i: number): void {
    if (!this.interactive()) return;
    this.cellPick.emit(i);
  }

  protected onContext(event: MouseEvent): void {
    if (!this.interactive()) return;
    event.preventDefault();
    this.rotateRequest.emit();
  }

  /**
   * Arrows are handled on the grid rather than on a cell: focus moves
   * asynchronously, and fast keypresses would otherwise be lost.
   */
  protected onKey(event: KeyboardEvent): void {
    if (!this.interactive()) return;
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
    if (!this.interactive()) return;
    this.hoverIdx.set(i);
    this.cellEnter.emit(i);
  }
}

/** A rectangle N cells long, in percentages of the 10×10 square. */
function patch(row: number, col: number, size: number, orient: 'h' | 'v'): Record<string, string> {
  return {
    left: `${col * 10}%`,
    top: `${row * 10}%`,
    width: `${(orient === 'h' ? size : 1) * 10}%`,
    height: `${(orient === 'v' ? size : 1) * 10}%`,
  };
}
