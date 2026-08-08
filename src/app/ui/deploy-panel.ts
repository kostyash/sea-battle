import { Component, computed, inject } from '@angular/core';
import { GameStore } from '../core/game-store';
import { DIFFICULTIES, levelHintKey, levelNameKey } from '../ai/levels';
import { I18n } from '../i18n/i18n';
import { ShipGlyph } from './ship-glyph';

@Component({
  selector: 'app-deploy-panel',
  imports: [ShipGlyph],
  template: `
    <section class="block">
      <p class="eyebrow">{{ i18n.t('fleet.title') }}</p>
      <ul class="roster">
        @for (r of store.roster(); track r.size) {
          <li>
            <button
              type="button"
              class="slot"
              [class.picked]="store.pickedSize() === r.size"
              [attr.aria-pressed]="store.pickedSize() === r.size"
              [disabled]="r.left === 0"
              (click)="store.pickSize(r.size)"
            >
              <span class="slot__glyph"><app-ship-glyph [size]="r.size" /></span>
              <span class="slot__label">
                <span class="slot__name">{{ i18n.shipName(r.size) }}</span>
                <span class="slot__decks">{{ i18n.t('fleet.decks', { n: r.size }) }}</span>
              </span>
              <span class="slot__count">{{ r.left }}<i>/{{ r.count }}</i></span>
            </button>
          </li>
        }
      </ul>

      <div class="row">
        <button type="button" class="btn btn--ghost" (click)="store.rotate()">
          {{ store.orient() === 'h' ? i18n.t('orient.h') : i18n.t('orient.v') }}
          <kbd>R</kbd>
        </button>
        <button type="button" class="btn btn--ghost" (click)="store.autoPlace()">
          {{ i18n.t('action.autoPlace') }}
        </button>
        <button type="button" class="btn btn--ghost" (click)="store.clearBoard()">
          {{ i18n.t('action.clear') }}
        </button>
      </div>

      <p class="hint">{{ i18n.t('deploy.hint') }}</p>
    </section>

    <section class="block">
      <p class="eyebrow">{{ i18n.t('opponent.title') }}</p>
      <div class="levels">
        @for (d of levels; track d) {
          <button
            type="button"
            class="level"
            [class.picked]="store.difficulty() === d"
            [attr.aria-pressed]="store.difficulty() === d"
            (click)="store.setDifficulty(d)"
          >
            <span class="level__name">{{ i18n.t(name(d)) }}</span>
            <span class="level__hint">{{ i18n.t(hint(d)) }}</span>
          </button>
        }
      </div>
    </section>

    <button
      type="button"
      class="btn btn--primary launch"
      [disabled]="!store.fleetReady()"
      (click)="store.beginBattle()"
    >
      {{
        store.fleetReady()
          ? i18n.t('action.toBattle')
          : i18n.t('deploy.remaining', { n: left() })
      }}
    </button>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .block {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
    }
    .roster {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .slot {
      --glyph-fill: rgba(159, 217, 227, 0.1);
      --glyph-stroke: rgba(159, 217, 227, 0.65);
      --glyph-detail: rgba(159, 217, 227, 0.45);
      display: grid;
      grid-template-columns: 4.6rem 1fr auto;
      align-items: center;
      gap: 0.7rem;
      width: 100%;
      padding: 0.36rem 0.6rem;
      border: 1px solid transparent;
      border-inline-start: 2px solid rgba(159, 217, 227, 0.2);
      background: rgba(159, 217, 227, 0.03);
      transition: all 0.16s ease;
    }
    .slot:hover:not(:disabled) {
      background: rgba(201, 154, 62, 0.08);
      border-inline-start-color: var(--brass);
    }
    .slot.picked {
      --glyph-fill: rgba(201, 154, 62, 0.22);
      --glyph-stroke: var(--brass);
      --glyph-detail: rgba(232, 223, 200, 0.8);
      background: rgba(201, 154, 62, 0.13);
      border-color: rgba(201, 154, 62, 0.4);
      border-inline-start-color: var(--brass);
    }
    .slot:disabled {
      opacity: 0.32;
      cursor: not-allowed;
    }
    .slot__glyph {
      display: block;
      height: 1.1rem;
    }
    .slot__label {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      line-height: 1.15;
    }
    .slot__name {
      text-align: start;
      font-size: 15px;
      letter-spacing: 0.03em;
      color: #cfe0e7;
    }
    .slot__decks {
      font-family: var(--data);
      font-size: 10px;
      letter-spacing: 0.12em;
      color: rgba(197, 216, 224, 0.5);
    }
    .slot.picked .slot__decks {
      color: rgba(201, 154, 62, 0.85);
    }
    .slot__count {
      font-family: var(--data);
      font-size: 13px;
      color: var(--brass);
    }
    .slot__count i {
      font-style: normal;
      opacity: 0.45;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .row .btn {
      flex: 1 1 auto;
      padding: 0.5em 0.7em;
      font-size: 13px;
    }
    kbd {
      font-family: var(--data);
      font-size: 10px;
      padding: 0.05em 0.35em;
      border: 1px solid rgba(201, 154, 62, 0.45);
      border-radius: 2px;
      color: var(--brass);
    }
    .hint {
      margin: 0;
      font-size: 12.5px;
      line-height: 1.42;
      color: rgba(197, 216, 224, 0.6);
    }
    .levels {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }
    .level {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.05rem;
      padding: 0.32rem 0.6rem;
      border: 1px solid rgba(159, 217, 227, 0.14);
      background: rgba(159, 217, 227, 0.03);
      text-align: start;
      transition: all 0.16s ease;
    }
    .level:hover {
      border-color: rgba(201, 154, 62, 0.5);
    }
    .level.picked {
      background: rgba(201, 154, 62, 0.13);
      border-color: rgba(201, 154, 62, 0.5);
    }
    .level__name {
      font-size: 15px;
      letter-spacing: 0.05em;
      color: #e2ecf0;
    }
    .level.picked .level__name {
      color: var(--brass);
    }
    .level__hint {
      font-size: 12px;
      color: rgba(197, 216, 224, 0.55);
    }
    .launch {
      padding: 0.72em 1em;
      font-size: 15px;
      letter-spacing: 0.14em;
    }
  `,
})
export class DeployPanel {
  protected readonly store = inject(GameStore);
  protected readonly i18n = inject(I18n);
  protected readonly levels = DIFFICULTIES;

  protected readonly name = levelNameKey;
  protected readonly hint = levelHintKey;

  /** How many pennants are still off the chart — the count the button reports. */
  protected readonly left = computed(() =>
    this.store.roster().reduce((sum, r) => sum + r.left, 0),
  );
}
