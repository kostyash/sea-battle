import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { GameStore } from '../core/game-store';
import { levelNameKey } from '../ai/levels';
import { I18n } from '../i18n/i18n';

@Component({
  selector: 'app-result-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
  template: `
    <div class="scrim" role="dialog" aria-modal="true" aria-labelledby="verdict">
      <div #card class="cartouche" [class.won]="won()" tabindex="-1">
        <p class="eyebrow">{{ i18n.t(won() ? 'result.wonEyebrow' : 'result.lostEyebrow') }}</p>
        <h2 id="verdict">{{ i18n.t(won() ? 'result.won' : 'result.lost') }}</h2>
        <p class="line">{{ store.messageText() }}</p>

        <dl class="figures">
          <div><dt>{{ i18n.t('stats.shots') }}</dt><dd>{{ store.playerStats().shots }}</dd></div>
          <div><dt>{{ i18n.t('stats.accuracy') }}</dt><dd>{{ store.playerStats().accuracy }}%</dd></div>
          <div><dt>{{ i18n.t('stats.sunk') }}</dt><dd>{{ store.enemyLosses() }}<i>/10</i></dd></div>
          <div><dt>{{ i18n.t('stats.lost') }}</dt><dd>{{ store.playerLosses() }}<i>/10</i></dd></div>
        </dl>

        <p class="against">{{ i18n.t('result.against', { text: levelName() }) }}</p>

        <div class="actions">
          <button type="button" class="btn btn--primary" (click)="store.rematch()">
            {{ i18n.t('action.rematch') }}
          </button>
          <button type="button" class="btn btn--ghost" (click)="store.newGame()">
            {{ i18n.t('action.redeploy') }}
          </button>
        </div>

        @if (store.reckoning().length) {
          <button type="button" class="btn btn--ghost reckon" (click)="store.openReplay()">
            {{ i18n.t('replay.open') }}
          </button>
        }

        <button type="button" class="survey" (click)="store.closeVerdict()">
          {{ i18n.t('action.survey') }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .scrim {
      position: fixed;
      inset: 0;
      z-index: 40;
      display: grid;
      place-items: center;
      padding: 1.5rem;
      background: radial-gradient(80% 60% at 50% 40%, rgba(7, 17, 25, 0.82), rgba(4, 9, 13, 0.96));
      backdrop-filter: blur(6px);
      animation: fade 0.5s ease both;
    }
    .cartouche {
      position: relative;
      max-width: 32rem;
      width: 100%;
      padding: 2.2rem 2rem 1.8rem;
      text-align: center;
      background: linear-gradient(180deg, rgba(18, 50, 70, 0.95), rgba(7, 17, 25, 0.97));
      border: 1px solid rgba(224, 71, 43, 0.4);
      box-shadow:
        0 0 0 1px rgba(0, 0, 0, 0.6),
        0 40px 90px -30px rgba(0, 0, 0, 0.95);
      animation: rise 0.6s cubic-bezier(0.2, 0.9, 0.25, 1) both;
    }
    .cartouche.won {
      border-color: rgba(201, 154, 62, 0.55);
    }
    .cartouche::before,
    .cartouche::after {
      content: '';
      position: absolute;
      inset-inline: 1.6rem;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--brass), transparent);
      opacity: 0.55;
    }
    .cartouche::before {
      top: 0.6rem;
    }
    .cartouche::after {
      bottom: 0.6rem;
    }
    h2 {
      font-family: var(--display);
      font-size: clamp(2.6rem, 9vw, 4.2rem);
      line-height: 0.95;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--signal-glow);
      margin: 0.35rem 0 0.5rem;
    }
    .won h2 {
      color: #f0d79a;
      text-shadow: 0 0 40px rgba(201, 154, 62, 0.45);
    }
    .line {
      margin: 0 0 1.4rem;
      font-size: 15px;
      color: rgba(214, 228, 234, 0.75);
    }
    .figures {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.6rem;
      margin: 0 0 1.3rem;
      padding: 0.9rem 0;
      border-top: 1px solid rgba(201, 154, 62, 0.22);
      border-bottom: 1px solid rgba(201, 154, 62, 0.22);
    }
    .figures div {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    dt {
      font-family: var(--data);
      font-size: 9px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(197, 216, 224, 0.45);
    }
    dd {
      margin: 0;
      font-family: var(--display);
      font-size: clamp(1.3rem, 5vw, 1.8rem);
      line-height: 1;
      color: #e6f0f4;
    }
    dd i {
      font-style: normal;
      font-size: 0.6em;
      opacity: 0.4;
    }
    .against {
      margin: 0 0 1.2rem;
      font-family: var(--data);
      font-size: 10px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--brass);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
      justify-content: center;
    }
    .reckon {
      margin-top: 0.9rem;
      font-size: 13px;
    }
    .survey {
      margin-top: 1.1rem;
      font-family: var(--data);
      font-size: 10px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: rgba(197, 216, 224, 0.55);
      border-bottom: 1px solid rgba(197, 216, 224, 0.25);
      padding-bottom: 2px;
    }
    .survey:hover {
      color: var(--brass);
      border-bottom-color: var(--brass);
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(18px) scale(0.97);
      }
    }
  `,
})
export class ResultOverlay {
  protected readonly store = inject(GameStore);
  protected readonly i18n = inject(I18n);
  protected readonly won = computed(() => this.store.winner() === 'player');
  protected readonly levelName = computed(() => this.i18n.t(levelNameKey(this.store.difficulty())));

  private readonly card = viewChild.required<ElementRef<HTMLElement>>('card');

  constructor() {
    // The card is declared modal — so focus is obliged to move into it, or Tab
    // wanders off into the masthead, which `aria-modal` has already hidden from
    // the screen reader.
    afterNextRender(() => this.card().nativeElement.focus());
  }

  /** Escape dismisses the card exactly as "survey the square" does. */
  protected onEscape(): void {
    this.store.closeVerdict();
  }
}
