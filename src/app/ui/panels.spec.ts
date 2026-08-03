import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_SEED, GameStore } from '../core/game-store';
import { FLEET_SHIPS } from '../domain/fleet';
import { BattlePanel } from './battle-panel';
import { DeployPanel } from './deploy-panel';
import { ResultOverlay } from './result-overlay';

const text = (fixture: ComponentFixture<unknown>): string =>
  (fixture.nativeElement as HTMLElement).textContent ?? '';

const buttons = (fixture: ComponentFixture<unknown>, selector: string): HTMLButtonElement[] =>
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(selector));

const setup = (seed = 4242): GameStore => {
  TestBed.configureTestingModule({ providers: [{ provide: GAME_SEED, useValue: seed }] });
  return TestBed.inject(GameStore);
};

describe('состав флота', () => {
  let store: GameStore;
  let fixture: ComponentFixture<DeployPanel>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    store = setup();
    fixture = TestBed.createComponent(DeployPanel);
    fixture.detectChanges();
  });

  it('перечисляет все четыре класса', () => {
    expect(buttons(fixture, '.slot')).toHaveLength(4);
  });

  it('у каждого класса подписано число палуб — размер виден до наведения', () => {
    const body = text(fixture);
    expect(body).toContain('4 палубы');
    expect(body).toContain('3 палубы');
    expect(body).toContain('2 палубы');
    expect(body).toContain('1 палуба');
  });

  it('показывает, сколько осталось поставить', () => {
    expect(text(fixture)).toContain('Линкор');
    expect(text(fixture)).toMatch(/1\s*\/\s*1/);
  });

  it('щелчок по классу выбирает калибр', () => {
    buttons(fixture, '.slot')[2].click(); // эсминец
    expect(store.pickedSize()).toBe(2);
  });

  it('исчерпанный класс блокируется', () => {
    store.autoPlace();
    fixture.detectChanges();
    expect(buttons(fixture, '.slot').every((b) => b.disabled)).toBe(true);
  });

  it('выбранный класс подсвечен', () => {
    buttons(fixture, '.slot')[1].click();
    fixture.detectChanges();
    expect(buttons(fixture, '.slot')[1].classList).toContain('picked');
  });

  it('кнопка поворота показывает текущую ориентацию', () => {
    expect(text(fixture)).toContain('Вдоль');
    store.rotate();
    fixture.detectChanges();
    expect(text(fixture)).toContain('Поперёк');
  });

  it('жребий расставляет весь флот', () => {
    const roll = buttons(fixture, '.btn').find((b) => b.textContent?.includes('жребию'))!;
    roll.click();
    expect(store.player().ships).toHaveLength(FLEET_SHIPS);
  });

  it('очистка убирает флот', () => {
    store.autoPlace();
    fixture.detectChanges();
    buttons(fixture, '.btn').find((b) => b.textContent?.includes('Очистить'))!.click();
    expect(store.player().ships).toHaveLength(0);
  });

  it('пока флот не собран, к бою не зовёт, а считает оставшихся', () => {
    const launch = buttons(fixture, '.launch')[0];
    expect(launch.disabled).toBe(true);
    expect(launch.textContent).toContain('Осталось поставить');
  });

  it('собранный флот открывает кнопку боя', () => {
    store.autoPlace();
    fixture.detectChanges();
    const launch = buttons(fixture, '.launch')[0];
    expect(launch.disabled).toBe(false);
    expect(launch.textContent).toContain('К бою');
    launch.click();
    expect(store.phase()).toBe('battle');
  });

  it('уровень противника выбирается щелчком', () => {
    const levels = buttons(fixture, '.level');
    expect(levels).toHaveLength(3);
    levels[2].click();
    expect(store.difficulty()).toBe('admiral');
  });
});

describe('донесение и журнал', () => {
  let store: GameStore;
  let fixture: ComponentFixture<BattlePanel>;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.resetTestingModule();
    store = setup(31);
    store.autoPlace();
    store.beginBattle();
    fixture = TestBed.createComponent(BattlePanel);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('показывает оба флота вымпелами', () => {
    const pips = (fixture.nativeElement as HTMLElement).querySelectorAll('.pip');
    expect(pips).toHaveLength(FLEET_SHIPS * 2);
  });

  it('чужие корабли до потопления показаны приглушённо', () => {
    const veiled = (fixture.nativeElement as HTMLElement).querySelectorAll('.pip.veiled');
    expect(veiled).toHaveLength(FLEET_SHIPS);
  });

  it('до первого залпа журнал приглашает стрелять, а не пустует', () => {
    expect(text(fixture)).toContain('Ни одного залпа');
  });

  it('после выстрела в журнале появляется запись с координатой', () => {
    const target = store.enemy().ships[0].cells[0];
    store.fireAt(target);
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();

    const entries = (fixture.nativeElement as HTMLElement).querySelectorAll('.log li');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].textContent).toMatch(/[А-Я]\d+/);
  });

  it('потопление отмечается в журнале словами', () => {
    let board = store.enemy();
    const boat = board.ships.find((s) => s.size === 1)!;
    store.fireAt(boat.cells[0]);
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(text(fixture)).toMatch(/потоплен/i);
  });

  it('считает залпы и точность', () => {
    store.fireAt(store.enemy().ships[0].cells[0]);
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(text(fixture)).toContain('100%');
  });

  it('подписывает уровень противника', () => {
    expect(text(fixture)).toContain('Мичман');
  });
});

describe('итоговая карточка', () => {
  let store: GameStore;

  const finish = (): ComponentFixture<ResultOverlay> => {
    const fixture = TestBed.createComponent(ResultOverlay);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.resetTestingModule();
    store = setup(3);
    store.autoPlace();
    store.beginBattle();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('после победы объявляет победу и считает итоги', () => {
    for (const cell of store.enemy().ships.flatMap((s) => s.cells)) {
      store.fireAt(cell);
      vi.advanceTimersByTime(1000);
    }
    vi.advanceTimersByTime(5000);

    const fixture = finish();
    const body = text(fixture);
    expect(body).toMatch(/Победа/i);
    expect(body).toMatch(/Точность/i);
    expect(body).toMatch(/Потоплено/i);
  });

  it('кнопка «ещё бой» начинает новую партию с готовым флотом', () => {
    for (const cell of store.enemy().ships.flatMap((s) => s.cells)) {
      store.fireAt(cell);
      vi.advanceTimersByTime(1000);
    }
    vi.advanceTimersByTime(5000);

    const fixture = finish();
    buttons(fixture, '.btn').find((b) => b.textContent?.includes('Ещё бой'))!.click();

    expect(store.phase()).toBe('deploy');
    expect(store.fleetReady()).toBe(true);
  });

  it('«осмотреть квадрат» убирает карточку, не начиная новую партию', () => {
    for (const cell of store.enemy().ships.flatMap((s) => s.cells)) {
      store.fireAt(cell);
      vi.advanceTimersByTime(1000);
    }
    vi.advanceTimersByTime(5000);

    const fixture = finish();
    buttons(fixture, '.survey')[0].click();

    expect(store.verdictOpen()).toBe(false);
    expect(store.phase()).toBe('over');
  });
});
