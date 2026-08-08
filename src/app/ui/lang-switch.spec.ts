import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { I18n } from '../i18n/i18n';
import { LangSwitch } from './lang-switch';

const buttons = (fixture: ComponentFixture<LangSwitch>): HTMLButtonElement[] =>
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button.lang'));

const group = (fixture: ComponentFixture<LangSwitch>): HTMLElement =>
  (fixture.nativeElement as HTMLElement).querySelector('[role="group"]')!;

const attrs = (fixture: ComponentFixture<LangSwitch>, name: string): (string | null)[] =>
  buttons(fixture).map((b) => b.getAttribute(name));

const root = document.documentElement;
const langBefore = root.getAttribute('lang');
const dirBefore = root.getAttribute('dir');

describe('the language switch', () => {
  let fixture: ComponentFixture<LangSwitch>;
  let i18n: I18n;

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    TestBed.configureTestingModule({});
    i18n = TestBed.inject(I18n);
    fixture = TestBed.createComponent(LangSwitch);
    fixture.detectChanges();
  });

  afterAll(() => {
    localStorage.clear();
    if (langBefore === null) root.removeAttribute('lang');
    else root.setAttribute('lang', langBefore);
    if (dirBefore === null) root.removeAttribute('dir');
    else root.setAttribute('dir', dirBefore);
  });

  it('offers all three languages at once, without a dropdown to open first', () => {
    expect(buttons(fixture)).toHaveLength(3);
  });

  it('labels every button in its own language rather than in the page language', () => {
    expect(buttons(fixture).map((b) => b.textContent?.trim())).toEqual(['EN', 'РУ', 'עב']);
  });

  it('marks each button with its own language, so a screen reader picks the right voice', () => {
    expect(attrs(fixture, 'lang')).toEqual(['en', 'ru', 'he']);
  });

  it('gives each button the full name of its language to hover over', () => {
    expect(attrs(fixture, 'title')).toEqual(['English', 'Русский', 'עברית']);
  });

  /**
   * `title` is not the accessible name — a button that has text content takes
   * its name from that content, so without this a screen reader announces the
   * Hebrew option as the two letters “עב” and never as “עברית”.
   */
  it('is announced by the full name of its language, not by its two-letter label', () => {
    expect(attrs(fixture, 'aria-label')).toEqual(['English', 'Русский', 'עברית']);
  });

  it('announces the choice for a screen reader and not by colour alone', () => {
    expect(attrs(fixture, 'aria-pressed')).toEqual(['true', 'false', 'false']);
    expect(buttons(fixture)[0].classList).toContain('picked');
  });

  it('a click switches the language of the game', () => {
    buttons(fixture)[1].click();

    expect(i18n.lang()).toBe('ru');
  });

  it('and the switch itself follows the choice at once', () => {
    buttons(fixture)[2].click();
    fixture.detectChanges();

    expect(attrs(fixture, 'aria-pressed')).toEqual(['false', 'false', 'true']);
    expect(buttons(fixture)[2].classList).toContain('picked');
    expect(buttons(fixture)[0].classList).not.toContain('picked');
  });

  it('the group names itself in the language now on', () => {
    expect(group(fixture).getAttribute('aria-label')).toBe('Language');

    buttons(fixture)[1].click();
    fixture.detectChanges();
    expect(group(fixture).getAttribute('aria-label')).toBe('Язык');

    buttons(fixture)[2].click();
    fixture.detectChanges();
    expect(group(fixture).getAttribute('aria-label')).toBe('שפה');
  });

  it('the buttons keep their own labels whatever the language of the page', () => {
    buttons(fixture)[2].click();
    fixture.detectChanges();

    expect(buttons(fixture).map((b) => b.textContent?.trim())).toEqual(['EN', 'РУ', 'עב']);
  });
});
