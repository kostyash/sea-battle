import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18n } from '../i18n/i18n';
import { LANGS } from '../i18n/lang';

/**
 * The language switch: three buttons, each labelled in its own language.
 *
 * Not a `<select>` on purpose — with three options a dropdown costs an extra
 * click and hides the current choice behind it, and the labels are short enough
 * to all fit on the rail. `aria-pressed` carries the choice for a screen reader,
 * and `lang` on each button makes it pronounce the label in its own language
 * rather than in the page's. That label is only ever two letters, though, and a
 * button takes its accessible name from its own text — so `aria-label` gives the
 * language its full name and “עב” is announced as “עברית”.
 */
@Component({
  selector: 'app-lang-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="langs" role="group" [attr.aria-label]="i18n.t('lang.group')">
      @for (l of langs; track l.id) {
        <button
          type="button"
          class="lang"
          [class.picked]="i18n.lang() === l.id"
          [attr.aria-pressed]="i18n.lang() === l.id"
          [attr.lang]="l.id"
          [attr.title]="l.name"
          [attr.aria-label]="l.name"
          (click)="i18n.setLang(l.id)"
        >
          {{ l.label }}
        </button>
      }
    </div>
  `,
  styles: `
    .langs {
      display: flex;
      border: 1px solid rgba(159, 217, 227, 0.22);
      border-radius: 1px;
    }
    .lang {
      padding: 0.5em 0.7em;
      font-family: var(--label);
      font-size: 12px;
      /* one of these labels is Hebrew whatever the page language is, so the
         tracking stays modest here rather than only under [dir='rtl'] */
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #a9c3ce;
      border-inline-start: 1px solid rgba(159, 217, 227, 0.22);
      transition:
        background 0.18s ease,
        color 0.18s ease;
    }
    .lang:first-child {
      border-inline-start: 0;
    }
    .lang:hover {
      background: rgba(159, 217, 227, 0.08);
    }
    .lang.picked {
      background: rgba(201, 154, 62, 0.16);
      color: var(--brass);
    }
  `,
})
export class LangSwitch {
  protected readonly i18n = inject(I18n);
  protected readonly langs = LANGS;
}
