import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameStore } from '../core/game-store';
import { difficultyName } from '../ai/levels';
import { Board } from '../domain/board';
import { isSunk } from '../domain/fleet';
import { ShipGlyph } from './ship-glyph';

interface Pip {
  id: number;
  size: number;
  lost: boolean;
}

@Component({
  selector: 'app-battle-panel',
  imports: [ShipGlyph],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="block">
      <p class="eyebrow">Донесение</p>
      <div class="fleets">
        <div class="fleet">
          <h3>Ваш флот</h3>
          <div class="pips">
            @for (p of mine(); track p.id) {
              <span class="pip" [class.lost]="p.lost" [style.width.rem]="p.size * 0.62">
                <app-ship-glyph [size]="p.size" />
              </span>
            }
          </div>
          <p class="tally">
            <b>{{ store.playerDecksLeft() }}</b> палуб на плаву
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
            <b>{{ store.enemyDecksLeft() }}</b> палуб на плаву
          </p>
        </div>
      </div>

      <dl class="stats">
        <div><dt>Залпов</dt><dd>{{ store.playerStats().shots }}</dd></div>
        <div><dt>Попаданий</dt><dd>{{ store.playerStats().hits }}</dd></div>
        <div><dt>Точность</dt><dd>{{ store.playerStats().accuracy }}%</dd></div>
      </dl>
    </section>

    <section class="block block--log">
      <p class="eyebrow">Журнал стрельбы</p>
      @if (store.log().length) {
        <ol class="log">
          @for (e of store.log(); track e.id) {
            <li [class.theirs]="e.side === 'enemy'" [class]="e.result">
              <span class="who">{{ e.side === 'player' ? 'МЫ' : 'ОН' }}</span>
              <span class="cell">{{ e.cell }}</span>
              <span class="what">
                @switch (e.result) {
                  @case ('miss') { мимо }
                  @case ('hit') { попадание }
                  @default { {{ e.ship }} потоплен }
                }
              </span>
            </li>
          }
        </ol>
      } @else {
        <p class="hint">Ни одного залпа. Наведите на квадрат противника и стреляйте.</p>
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
      padding: 0 0.4rem 0 0;
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
      border-left: 2px solid rgba(159, 217, 227, 0.25);
      background: rgba(159, 217, 227, 0.03);
      animation: slide-in 0.3s ease both;
    }
    .log li.theirs {
      border-left-color: rgba(224, 71, 43, 0.4);
    }
    .log li.hit,
    .log li.sunk {
      background: rgba(224, 71, 43, 0.09);
    }
    .log li.sunk .what {
      color: var(--signal-glow);
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
    @keyframes slide-in {
      from {
        opacity: 0;
        transform: translateX(-6px);
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

  protected readonly mine = computed(() => pips(this.store.player()));
  protected readonly theirs = computed(() => pips(this.store.enemy()));

  protected readonly levelName = computed(() => difficultyName(this.store.difficulty()));
}

function pips(board: Board): Pip[] {
  return [...board.ships]
    .sort((a, b) => b.size - a.size)
    .map((s) => ({ id: s.id, size: s.size, lost: isSunk(s) }));
}
