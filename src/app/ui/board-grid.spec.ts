import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Board, emptyBoard } from '../domain/board';
import { CELLS, idx } from '../domain/grid';
import { canonicalBoard, shipCells, withShip } from '../domain/placement';
import { fire } from '../domain/shot';
import { I18n } from '../i18n/i18n';
import { Lang } from '../i18n/lang';
import { BoardGrid } from './board-grid';

const cellButtons = (fixture: ComponentFixture<BoardGrid>): HTMLButtonElement[] =>
  Array.from(fixture.nativeElement.querySelectorAll('button.cell'));

// a div on purpose: the class `hull` is worn by the hull path inside the SVG too
const hulls = (fixture: ComponentFixture<BoardGrid>): HTMLElement[] =>
  Array.from(fixture.nativeElement.querySelectorAll('div.hull'));

const rowLetters = (fixture: ComponentFixture<BoardGrid>): string[] =>
  Array.from(fixture.nativeElement.querySelectorAll('.gutter--rows span'), (span: Element) =>
    (span.textContent ?? '').trim(),
  );

describe('BoardGrid', () => {
  let fixture: ComponentFixture<BoardGrid>;

  const render = (board: Board, options: Record<string, unknown> = {}) => {
    fixture = TestBed.createComponent(BoardGrid);
    fixture.componentRef.setInput('board', board);
    fixture.componentRef.setInput('variant', 'chart');
    fixture.componentRef.setInput('caption', 'Your square');
    for (const [key, value] of Object.entries(options)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return fixture;
  };

  const speak = (lang: Lang) => TestBed.inject(I18n).setLang(lang);

  describe('the grid', () => {
    it('draws all one hundred cells', () => {
      render(emptyBoard('player'));
      expect(cellButtons(fixture)).toHaveLength(CELLS);
    });

    it('lays the cells out ten to a row, and gives every row the row role', () => {
      render(emptyBoard('player'));
      const rows = fixture.nativeElement.querySelectorAll('[role="row"]');
      expect(rows).toHaveLength(10);
      expect(rows[0].querySelectorAll('button.cell')).toHaveLength(10);
    });

    it('signs every cell with its coordinate and its state', () => {
      render(emptyBoard('player'));
      const cells = cellButtons(fixture);
      expect(cells[0].getAttribute('aria-label')).toBe('A1 — not fired at');
      expect(cells[idx(1, 3)].getAttribute('aria-label')).toBe('B4 — not fired at');
      expect(cells[CELLS - 1].getAttribute('aria-label')).toBe('J10 — not fired at');
    });

    it('puts the caption of the board into the markup', () => {
      render(emptyBoard('player'));
      expect(fixture.nativeElement.querySelector('[role="grid"]').getAttribute('aria-label')).toBe(
        'Your square',
      );
    });
  });

  describe('interactivity', () => {
    it('an inactive board marks its cells as unavailable', () => {
      render(emptyBoard('player'), { interactive: false });
      expect(cellButtons(fixture).every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(
        true,
      );
    });

    it('inactive cells stay focusable — otherwise the aim flies away', () => {
      render(emptyBoard('player'), { interactive: false });
      // `disabled` would pull focus off the button, and after every shot the
      // keyboard aim would be lost on the body
      expect(cellButtons(fixture).some((b) => b.disabled)).toBe(false);
    });

    it('an active board opens its cells up', () => {
      render(emptyBoard('player'), { interactive: true });
      expect(cellButtons(fixture).every((b) => b.getAttribute('aria-disabled') === 'false')).toBe(
        true,
      );
    });

    it('focus survives the board being switched off and on again', () => {
      render(emptyBoard('player'), { interactive: true });
      const cell = cellButtons(fixture)[idx(3, 3)];
      cell.focus();
      expect(document.activeElement).toBe(cell);

      fixture.componentRef.setInput('interactive', false);
      fixture.detectChanges();
      expect(document.activeElement).toBe(cell);

      fixture.componentRef.setInput('interactive', true);
      fixture.detectChanges();
      expect(document.activeElement).toBe(cell);
    });

    it('a click hands back the number of the cell', () => {
      render(emptyBoard('player'), { interactive: true });
      const picked: number[] = [];
      fixture.componentInstance.cellPick.subscribe((c) => picked.push(c));

      cellButtons(fixture)[idx(3, 7)].click();
      expect(picked).toEqual([idx(3, 7)]);
    });

    it('an unavailable cell hands back no click', () => {
      render(emptyBoard('player'), { interactive: false });
      const picked: number[] = [];
      fixture.componentInstance.cellPick.subscribe((c) => picked.push(c));

      cellButtons(fixture)[0].click();
      expect(picked).toEqual([]);
    });

    it('an unavailable board does not walk the aim with the arrows', () => {
      render(emptyBoard('player'), { interactive: false });
      cellButtons(fixture)[0].focus();
      fixture.nativeElement
        .querySelector('[role="grid"]')
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      fixture.detectChanges();

      expect(cellButtons(fixture).findIndex((b) => b.getAttribute('tabindex') === '0')).toBe(0);
    });

    it('the right button asks for a rotation and opens no menu', () => {
      render(emptyBoard('player'), { interactive: true });
      let asked = 0;
      fixture.componentInstance.rotateRequest.subscribe(() => asked++);

      const event = new MouseEvent('contextmenu', { cancelable: true, bubbles: true });
      fixture.nativeElement.querySelector('[role="grid"]').dispatchEvent(event);

      expect(asked).toBe(1);
      expect(event.defaultPrevented).toBe(true);
    });

    /**
     * The cell has to travel with the request: right-click turns whatever is
     * under the pointer, and the grid is the only thing that knows which square
     * that was.
     */
    it('the right button reports the square it landed on', () => {
      render(emptyBoard('player'), { interactive: true });
      const asked: number[] = [];
      fixture.componentInstance.rotateRequest.subscribe((cell) => asked.push(cell));

      const square = fixture.nativeElement.querySelectorAll('button.cell')[idx(3, 7)];
      square.dispatchEvent(new MouseEvent('contextmenu', { cancelable: true, bubbles: true }));

      expect(asked).toEqual([idx(3, 7)]);
    });

    it('a right click that lands between the squares reports none of them', () => {
      render(emptyBoard('player'), { interactive: true });
      const asked: number[] = [];
      fixture.componentInstance.rotateRequest.subscribe((cell) => asked.push(cell));

      fixture.nativeElement
        .querySelector('[role="grid"]')
        .dispatchEvent(new MouseEvent('contextmenu', { cancelable: true, bubbles: true }));

      expect(asked).toEqual([-1]);
    });

    it('on an inactive board the right button asks for nothing', () => {
      render(emptyBoard('player'), { interactive: false });
      let asked = 0;
      fixture.componentInstance.rotateRequest.subscribe(() => asked++);

      fixture.nativeElement
        .querySelector('[role="grid"]')
        .dispatchEvent(new MouseEvent('contextmenu', { cancelable: true, bubbles: true }));

      expect(asked).toBe(0);
    });
  });

  describe('the keyboard', () => {
    const press = (key: string) => {
      const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
      fixture.nativeElement.querySelector('[role="grid"]').dispatchEvent(event);
      fixture.detectChanges();
      return event;
    };

    it('exactly one cell takes part in the tab order', () => {
      render(emptyBoard('player'), { interactive: true });
      const reachable = cellButtons(fixture).filter((b) => b.getAttribute('tabindex') === '0');
      expect(reachable).toHaveLength(1);
    });

    it('the arrows walk the aim across the grid', () => {
      render(emptyBoard('player'), { interactive: true });
      cellButtons(fixture)[0].focus();

      press('ArrowDown');
      press('ArrowDown');
      press('ArrowRight');
      press('ArrowRight');
      press('ArrowRight');

      const focused = cellButtons(fixture).findIndex((b) => b.getAttribute('tabindex') === '0');
      expect(focused).toBe(idx(2, 3));
    });

    it('an arrow does not jump over the edge of a row', () => {
      render(emptyBoard('player'), { interactive: true });
      cellButtons(fixture)[idx(0, 9)].focus();
      press('ArrowRight');
      const focused = cellButtons(fixture).findIndex((b) => b.getAttribute('tabindex') === '0');
      expect(focused).toBe(idx(0, 9));
    });

    it('an arrow does not walk off the top edge', () => {
      render(emptyBoard('player'), { interactive: true });
      cellButtons(fixture)[0].focus();
      press('ArrowUp');
      const focused = cellButtons(fixture).findIndex((b) => b.getAttribute('tabindex') === '0');
      expect(focused).toBe(0);
    });

    it('an unrelated key moves nothing and does not swallow the event', () => {
      render(emptyBoard('player'), { interactive: true });
      cellButtons(fixture)[0].focus();
      const event = press('Tab');
      expect(event.defaultPrevented).toBe(false);
      // the aim has to stay put — without this the test only held preventDefault
      expect(cellButtons(fixture).findIndex((b) => b.getAttribute('tabindex') === '0')).toBe(0);
    });
  });

  describe('the language', () => {
    it('spells the row gutter in the alphabet of the active language', () => {
      render(emptyBoard('player'));
      expect(rowLetters(fixture)).toEqual([...'ABCDEFGHIJ']);

      speak('ru');
      fixture.detectChanges();
      expect(rowLetters(fixture)).toEqual([...'АБВГДЕЖЗИК']);

      speak('he');
      fixture.detectChanges();
      expect(rowLetters(fixture)).toEqual([...'אבגדהוזחטי']);
    });

    it('spells the label of a cell in the active language', () => {
      speak('ru');
      render(emptyBoard('player'));
      expect(cellButtons(fixture)[idx(1, 3)].getAttribute('aria-label')).toBe(
        'Б4 — не пристреляна',
      );
    });

    it('does not mirror the square in Hebrew — overlays and arrows both count from cell 0', () => {
      speak('he');
      render(emptyBoard('player'), { interactive: true });

      expect(fixture.nativeElement.querySelector('.frame').getAttribute('dir')).toBe('ltr');

      cellButtons(fixture)[idx(4, 4)].focus();
      fixture.nativeElement
        .querySelector('[role="grid"]')
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      fixture.detectChanges();

      // ArrowRight walks forward, not back: in a mirrored square it would not
      expect(cellButtons(fixture).findIndex((b) => b.getAttribute('tabindex') === '0')).toBe(
        idx(4, 5),
      );
    });
  });

  describe('the ships on the chart', () => {
    it('shows the whole fleet on your own chart', () => {
      render(canonicalBoard('player'));
      expect(hulls(fixture)).toHaveLength(10);
    });

    it('a silhouette covers exactly its own cells across', () => {
      const board = withShip(emptyBoard('player'), 2, 1, 4, 'h');
      render(board);
      const hull = hulls(fixture)[0];
      expect(hull.style.width).toBe('40%');
      expect(hull.style.height).toBe('10%');
      expect(hull.style.left).toBe('10%');
      expect(hull.style.top).toBe('20%');
    });

    it('a turned ship covers its own cells downwards', () => {
      const board = withShip(emptyBoard('player'), 2, 1, 3, 'v');
      render(board);
      const hull = hulls(fixture)[0];
      expect(hull.style.width).toBe('10%');
      expect(hull.style.height).toBe('30%');
    });

    it('shows nothing in foreign waters until it has been sunk', () => {
      render(canonicalBoard('enemy'), { variant: 'abyss' });
      expect(hulls(fixture)).toHaveLength(0);
    });

    it("draws a sunk ship onto the opponent's square", () => {
      let board = canonicalBoard('enemy');
      for (const cell of board.ships[0].cells) board = fire(board, cell).board;
      render(board, { variant: 'abyss' });
      expect(hulls(fixture)).toHaveLength(1);
    });

    it("uncovers the opponent's square in full once the battle is over", () => {
      render(canonicalBoard('enemy'), { variant: 'abyss', surveyed: true });
      expect(hulls(fixture)).toHaveLength(10);
    });
  });

  describe('the silhouette under the cursor', () => {
    it('shows the real size of the picked ship, not a single cell', () => {
      render(emptyBoard('player'), {
        interactive: true,
        ghost: { cells: shipCells(4, 2, 4, 'h'), valid: true, size: 4, orient: 'h' },
      });

      const ghost: HTMLElement = fixture.nativeElement.querySelector('.ghost');
      expect(ghost).toBeTruthy();
      expect(ghost.style.width).toBe('40%');
      expect(ghost.style.left).toBe('20%');
      expect(ghost.style.top).toBe('40%');
    });

    it('a turned silhouette grows downwards, not sideways', () => {
      render(emptyBoard('player'), {
        interactive: true,
        ghost: { cells: shipCells(1, 1, 3, 'v'), valid: true, size: 3, orient: 'v' },
      });
      const ghost: HTMLElement = fixture.nativeElement.querySelector('.ghost');
      expect(ghost.style.height).toBe('30%');
      expect(ghost.style.width).toBe('10%');
    });

    it('marks a placement that is not allowed', () => {
      render(emptyBoard('player'), {
        interactive: true,
        ghost: { cells: shipCells(0, 0, 2, 'h'), valid: false, size: 2, orient: 'h' },
      });
      expect(fixture.nativeElement.querySelector('.ghost').classList).toContain('blocked');
    });

    it('with no ship picked there is no silhouette', () => {
      render(emptyBoard('player'), { interactive: true, ghost: null });
      expect(fixture.nativeElement.querySelector('.ghost')).toBeNull();
    });
  });

  describe('the marks left by shots', () => {
    it('marks a miss, a hit and a sinking differently', () => {
      let board = withShip(emptyBoard('enemy'), 0, 0, 2, 'h');
      board = fire(board, idx(5, 5)).board; // wide
      board = fire(board, idx(0, 0)).board; // on target
      render(board, { variant: 'abyss' });

      const cells = cellButtons(fixture);
      expect(cells[idx(5, 5)].classList).toContain('miss');
      expect(cells[idx(0, 0)].classList).toContain('hit');
    });

    it('a sunk ship marks every one of its cells', () => {
      let board = withShip(emptyBoard('enemy'), 0, 0, 2, 'h');
      board = fire(board, idx(0, 0)).board;
      board = fire(board, idx(0, 1)).board;
      render(board, { variant: 'abyss' });

      const cells = cellButtons(fixture);
      expect(cells[idx(0, 0)].classList).toContain('sunk');
      expect(cells[idx(0, 1)].classList).toContain('sunk');
    });

    it('puts the state of a cell into the label a screen reader reads', () => {
      let board = withShip(emptyBoard('enemy'), 0, 0, 1, 'h');
      board = fire(board, idx(0, 0)).board;
      render(board, { variant: 'abyss' });
      expect(cellButtons(fixture)[idx(0, 0)].getAttribute('aria-label')).toBe('A1 — sunk');
    });
  });
});
