import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Board, emptyBoard } from '../domain/board';
import { CELLS, idx } from '../domain/grid';
import { canonicalBoard, shipCells, withShip } from '../domain/placement';
import { fire } from '../domain/shot';
import { BoardGrid } from './board-grid';

const cellButtons = (fixture: ComponentFixture<BoardGrid>): HTMLButtonElement[] =>
  Array.from(fixture.nativeElement.querySelectorAll('button.cell'));

// именно div: класс `hull` носит ещё и путь корпуса внутри SVG
const hulls = (fixture: ComponentFixture<BoardGrid>): HTMLElement[] =>
  Array.from(fixture.nativeElement.querySelectorAll('div.hull'));

describe('BoardGrid', () => {
  let fixture: ComponentFixture<BoardGrid>;

  const render = (board: Board, options: Record<string, unknown> = {}) => {
    fixture = TestBed.createComponent(BoardGrid);
    fixture.componentRef.setInput('board', board);
    fixture.componentRef.setInput('variant', 'chart');
    fixture.componentRef.setInput('caption', 'Ваш квадрат');
    for (const [key, value] of Object.entries(options)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  describe('сетка', () => {
    it('рисует все сто клеток', () => {
      render(emptyBoard('player'));
      expect(cellButtons(fixture)).toHaveLength(CELLS);
    });

    it('раскладывает клетки по десять в ряд с ролью строки', () => {
      render(emptyBoard('player'));
      const rows = fixture.nativeElement.querySelectorAll('[role="row"]');
      expect(rows).toHaveLength(10);
      expect(rows[0].querySelectorAll('button.cell')).toHaveLength(10);
    });

    it('каждая клетка подписана координатой и состоянием', () => {
      render(emptyBoard('player'));
      const cells = cellButtons(fixture);
      expect(cells[0].getAttribute('aria-label')).toBe('А1 — не пристреляна');
      expect(cells[idx(1, 3)].getAttribute('aria-label')).toBe('Б4 — не пристреляна');
      expect(cells[CELLS - 1].getAttribute('aria-label')).toBe('К10 — не пристреляна');
    });

    it('подпись поля попадает в разметку', () => {
      render(emptyBoard('player'));
      expect(fixture.nativeElement.querySelector('[role="grid"]').getAttribute('aria-label')).toBe(
        'Ваш квадрат',
      );
    });
  });

  describe('интерактивность', () => {
    it('неактивное поле блокирует все клетки', () => {
      render(emptyBoard('player'), { interactive: false });
      expect(cellButtons(fixture).every((b) => b.disabled)).toBe(true);
    });

    it('активное поле открывает клетки', () => {
      render(emptyBoard('player'), { interactive: true });
      expect(cellButtons(fixture).every((b) => b.disabled)).toBe(false);
    });

    it('щелчок отдаёт номер клетки', () => {
      render(emptyBoard('player'), { interactive: true });
      const picked: number[] = [];
      fixture.componentInstance.cellPick.subscribe((c) => picked.push(c));

      cellButtons(fixture)[idx(3, 7)].click();
      expect(picked).toEqual([idx(3, 7)]);
    });

    it('заблокированная клетка щелчок не отдаёт', () => {
      render(emptyBoard('player'), { interactive: false });
      const picked: number[] = [];
      fixture.componentInstance.cellPick.subscribe((c) => picked.push(c));

      cellButtons(fixture)[0].click();
      expect(picked).toEqual([]);
    });

    it('правая кнопка просит поворот и не открывает меню', () => {
      render(emptyBoard('player'), { interactive: true });
      let asked = 0;
      fixture.componentInstance.rotateRequest.subscribe(() => asked++);

      const event = new MouseEvent('contextmenu', { cancelable: true, bubbles: true });
      fixture.nativeElement.querySelector('[role="grid"]').dispatchEvent(event);

      expect(asked).toBe(1);
      expect(event.defaultPrevented).toBe(true);
    });

    it('на неактивном поле правая кнопка ничего не просит', () => {
      render(emptyBoard('player'), { interactive: false });
      let asked = 0;
      fixture.componentInstance.rotateRequest.subscribe(() => asked++);

      fixture.nativeElement
        .querySelector('[role="grid"]')
        .dispatchEvent(new MouseEvent('contextmenu', { cancelable: true, bubbles: true }));

      expect(asked).toBe(0);
    });
  });

  describe('клавиатура', () => {
    const press = (key: string) => {
      const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
      fixture.nativeElement.querySelector('[role="grid"]').dispatchEvent(event);
      fixture.detectChanges();
      return event;
    };

    it('в обходе участвует ровно одна клетка', () => {
      render(emptyBoard('player'), { interactive: true });
      const reachable = cellButtons(fixture).filter((b) => b.getAttribute('tabindex') === '0');
      expect(reachable).toHaveLength(1);
    });

    it('стрелки двигают прицел по сетке', () => {
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

    it('стрелка не перескакивает через край строки', () => {
      render(emptyBoard('player'), { interactive: true });
      cellButtons(fixture)[idx(0, 9)].focus();
      press('ArrowRight');
      const focused = cellButtons(fixture).findIndex((b) => b.getAttribute('tabindex') === '0');
      expect(focused).toBe(idx(0, 9));
    });

    it('стрелка не уходит за верхний край', () => {
      render(emptyBoard('player'), { interactive: true });
      cellButtons(fixture)[0].focus();
      press('ArrowUp');
      const focused = cellButtons(fixture).findIndex((b) => b.getAttribute('tabindex') === '0');
      expect(focused).toBe(0);
    });

    it('посторонняя клавиша ничего не двигает и не гасит событие', () => {
      render(emptyBoard('player'), { interactive: true });
      cellButtons(fixture)[0].focus();
      const event = press('Tab');
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('корабли на карте', () => {
    it('на своей карте виден весь флот', () => {
      render(canonicalBoard('player'));
      expect(hulls(fixture)).toHaveLength(10);
    });

    it('силуэт занимает ровно свои клетки по ширине', () => {
      const board = withShip(emptyBoard('player'), 2, 1, 4, 'h');
      render(board);
      const hull = hulls(fixture)[0];
      expect(hull.style.width).toBe('40%');
      expect(hull.style.height).toBe('10%');
      expect(hull.style.left).toBe('10%');
      expect(hull.style.top).toBe('20%');
    });

    it('повёрнутый корабль занимает свои клетки по высоте', () => {
      const board = withShip(emptyBoard('player'), 2, 1, 3, 'v');
      render(board);
      const hull = hulls(fixture)[0];
      expect(hull.style.width).toBe('10%');
      expect(hull.style.height).toBe('30%');
    });

    it('в чужих водах не видно ничего, пока не потопили', () => {
      render(canonicalBoard('enemy'), { variant: 'abyss' });
      expect(hulls(fixture)).toHaveLength(0);
    });

    it('потопленный корабль наносится на чужой квадрат', () => {
      let board = canonicalBoard('enemy');
      for (const cell of board.ships[0].cells) board = fire(board, cell).board;
      render(board, { variant: 'abyss' });
      expect(hulls(fixture)).toHaveLength(1);
    });

    it('после боя чужой квадрат вскрывается целиком', () => {
      render(canonicalBoard('enemy'), { variant: 'abyss', surveyed: true });
      expect(hulls(fixture)).toHaveLength(10);
    });
  });

  describe('силуэт под курсором', () => {
    it('показывает настоящий размер выбранного корабля, а не одну клетку', () => {
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

    it('повёрнутый силуэт растёт вниз, а не вбок', () => {
      render(emptyBoard('player'), {
        interactive: true,
        ghost: { cells: shipCells(1, 1, 3, 'v'), valid: true, size: 3, orient: 'v' },
      });
      const ghost: HTMLElement = fixture.nativeElement.querySelector('.ghost');
      expect(ghost.style.height).toBe('30%');
      expect(ghost.style.width).toBe('10%');
    });

    it('недопустимая постановка помечается', () => {
      render(emptyBoard('player'), {
        interactive: true,
        ghost: { cells: shipCells(0, 0, 2, 'h'), valid: false, size: 2, orient: 'h' },
      });
      expect(fixture.nativeElement.querySelector('.ghost').classList).toContain('blocked');
    });

    it('без выбранного корабля силуэта нет', () => {
      render(emptyBoard('player'), { interactive: true, ghost: null });
      expect(fixture.nativeElement.querySelector('.ghost')).toBeNull();
    });
  });

  describe('отметки выстрелов', () => {
    it('промах, попадание и потопление помечаются по-разному', () => {
      let board = withShip(emptyBoard('enemy'), 0, 0, 2, 'h');
      board = fire(board, idx(5, 5)).board; // мимо
      board = fire(board, idx(0, 0)).board; // попал
      render(board, { variant: 'abyss' });

      const cells = cellButtons(fixture);
      expect(cells[idx(5, 5)].classList).toContain('miss');
      expect(cells[idx(0, 0)].classList).toContain('hit');
    });

    it('потопленный корабль помечает все свои клетки', () => {
      let board = withShip(emptyBoard('enemy'), 0, 0, 2, 'h');
      board = fire(board, idx(0, 0)).board;
      board = fire(board, idx(0, 1)).board;
      render(board, { variant: 'abyss' });

      const cells = cellButtons(fixture);
      expect(cells[idx(0, 0)].classList).toContain('sunk');
      expect(cells[idx(0, 1)].classList).toContain('sunk');
    });

    it('состояние клетки попадает в подпись для чтения с экрана', () => {
      let board = withShip(emptyBoard('enemy'), 0, 0, 1, 'h');
      board = fire(board, idx(0, 0)).board;
      render(board, { variant: 'abyss' });
      expect(cellButtons(fixture)[idx(0, 0)].getAttribute('aria-label')).toBe('А1 — потоплен');
    });
  });
});
