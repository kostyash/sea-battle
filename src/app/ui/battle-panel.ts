import { Component, computed, inject } from '@angular/core';
import { GameStore } from '../core/game-store';
import { levelNameKey } from '../ai/levels';
import { Board } from '../domain/board';
import { isSunk } from '../domain/fleet';
import { I18n } from '../i18n/i18n';
import { ShipGlyph } from './ship-glyph';

interface Pip {
  id: number;
  size: number;
  lost: boolean;
}

@Component({
  selector: 'app-battle-panel',
  imports: [ShipGlyph],
  template: `
    <section class="block">
      <p class="eyebrow">{{ i18n.t('battle.report') }}</p>
      <div class="fleets">
        <div class="fleet">
          <h3>{{ i18n.t('battle.yourFleet') }}</h3>
          <div class="pips">
            @for (p of mine(); track p.id) {
              <span class="pip" [class.lost]="p.lost" [style.width.rem]="p.size * 0.62">
                <app-ship-glyph [size]="p.size" />
              </span>
            }
          </div>
          <p class="tally">
            <b>{{ store.playerDecksLeft() }}</b>
            {{ i18n.t('battle.decksAfloat', { n: store.playerDecksLeft() }) }}
          </p>
        </div>
        <div class="fleet">
          <h3>{{ levelName() }}</h3>
          <div class="pips">
            @for (p of theirs(); track p.id) {
              <span class="pip" [class.lost]="p.lost" [class.veiled]="!p.lost" [style.width.rem]="p.size * 0.62">
                <app-ship-glyph [size]="p.size" />
              </span>
            }
          </div>
          <p class="tally">
            <b>{{ store.enemyDecksLeft() }}</b>
            {{ i18n.t('battle.decksAfloat', { n: store.enemyDecksLeft() }) }}
          </p>
        </div>
      </div>

      <dl class="stats">
        <div><dt>{{ i18n.t('stats.shots') }}</dt><dd>{{ store.playerStats().shots }}</dd></div>
        <div><dt>{{ i18n.t('stats.hits') }}</dt><dd>{{ store.playerStats().hits }}</dd></div>
        <div><dt>{{ i18n.t('stats.accuracy') }}</dt><dd>{{ store.playerStats().accuracy }}%</dd></div>
      </dl>
    </section>

    <section class="block block--log">
      <p class="eyebrow">{{ i18n.t('battle.log') }}</p>
      @if (store.log().length) {
        <ol class="log">
          @for (e of store.log(); track e.id) {
            <li [class.theirs]="e.side === 'enemy'" [class]="e.result">
              <span class="who">{{ i18n.t(e.side === 'player' ? 'log.us' : 'log.them') }}</span>
              <span class="cell">{{ i18n.coord(e.cell) }}</span>
              <span class="what">
                @switch (e.result) {
                  @case ('miss') { {{ i18n.t('log.miss') }} }
                  @case ('hit') { {{ i18n.t('log.hit') }} }
                  @default { {{ i18n.t('log.sunk', { size: e.shipSize ?? 0 }) }} }
                }
              </span>
            </li>
          }
        </ol>
      } @else {
        <p class="hint">{{ i18n.t('battle.logEmpty') }}</p>
      }
    </section>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.1rem;
      min-height: 0;
    }
    .block {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    .block--log {
      min-height: 0;
      flex: 1 1 auto;
    }
    .fleets {
      display: grid;
      gap: 0.9rem;
    }
    h3 {
      font-family: var(--label);
      font-size: 13px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(197, 216, 224, 0.7);
    }
    .pips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem 0.45rem;
      margin-top: 0.35rem;
    }
    .pip {
      --glyph-fill: rgba(159, 217, 227, 0.12);
      --glyph-stroke: rgba(159, 217, 227, 0.7);
      --glyph-detail: rgba(159, 217, 227, 0.45);
      display: block;
      height: 0.62rem;
      transition: opacity 0.3s ease;
    }
    .pip.veiled {
      --glyph-fill: rgba(159, 217, 227, 0.04);
      --glyph-stroke: rgba(159, 217, 227, 0.3);
      --glyph-detail: rgba(159, 217, 227, 0.2);
    }
    .pip.lost {
      --glyph-fill: rgba(224, 71, 43, 0.28);
      --glyph-stroke: var(--signal);
      --glyph-detail: rgba(224, 71, 43, 0.7);
      opacity: 0.8;
    }
    .tally {
      margin: 0.45rem 0 0;
      font-family: var(--data);
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(197, 216, 224, 0.5);
    }
    .tally b {
      color: var(--brass);
      font-size: 15px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      margin: 0;
      padding-top: 0.7rem;
      border-top: 1px solid rgba(201, 154, 62, 0.2);
    }
    .stats div {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }
    dt {
      font-family: var(--data);
      font-size: 9px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: rgba(197, 216, 224, 0.45);
    }
    dd {
      margin: 0;
      font-family: var(--display);
      font-size: 22px;
      line-height: 1;
      color: #e6f0f4;
    }
    .log {
      list-style: none;
      margin: 0;
      padding: 0;
      padding-inline-end: 0.4rem;
      display: flex;
      flex-direction: column;
      gap: 1px;
      overflow-y: auto;
      max-height: 15rem;
      scrollbar-width: thin;
      scrollbar-color: rgba(201, 154, 62, 0.4) transparent;
    }
    .log li {
      display: grid;
      grid-template-columns: 1.9rem 2.7rem 1fr;
      align-items: baseline;
      gap: 0.4rem;
      padding: 0.22rem 0.4rem;
      font-family: var(--data);
      font-size: 12px;
      border-inline-start: 2px solid rgba(159, 217, 227, 0.25);
      background: rgba(159, 217, 227, 0.03);
      animation: slide-in 0.3s ease both;
    }
    .log li.theirs {
      border-inline-start-color: rgba(224, 71, 43, 0.4);
    }
    .log li.hit,
    .log li.sunk {
      background: rgba(224, 71, 43, 0.09);
    }
    /* Weight as well as case: Hebrew has no capitals, so text-transform is a
       no-op on it and the sunk line would be marked by colour alone. */
    .log li.sunk .what {
      color: var(--signal-glow);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .who {
      font-size: 9px;
      letter-spacing: 0.1em;
      color: rgba(197, 216, 224, 0.45);
    }
    .cell {
      color: var(--brass);
      font-weight: 600;
    }
    .what {
      color: rgba(214, 228, 234, 0.8);
    }
    /* a new line slides in from the side the text starts on — see --flip */
    @keyframes slide-in {
      from {
        opacity: 0;
        transform: translateX(calc(-6px * var(--flip, 1)));
      }
    }
    .hint {
      margin: 0;
      font-size: 13px;
      color: rgba(197, 216, 224, 0.55);
    }
    @container (min-width: 460px) {
      .fleets {
        grid-template-columns: 1fr 1fr;
      }
    }
  `,
})
export class BattlePanel {
  protected readonly store = inject(GameStore);
  protected readonly i18n = inject(I18n);

  protected readonly mine = computed(() => pips(this.store.player()));
  protected readonly theirs = computed(() => pips(this.store.enemy()));

  protected readonly levelName = computed(() => this.i18n.t(levelNameKey(this.store.difficulty())));
}

function pips(board: Board): Pip[] {
  return [...board.ships]
    .sort((a, b) => b.size - a.size)
    .map((s) => ({ id: s.id, size: s.size, lost: isSunk(s) }));
}
