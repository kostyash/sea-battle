import { Component, computed, inject } from '@angular/core';
import { GameStore } from './core/game-store';
import { I18n } from './i18n/i18n';
import { BattlePanel } from './ui/battle-panel';
import { BoardGrid } from './ui/board-grid';
import { DeployPanel } from './ui/deploy-panel';
import { LangSwitch } from './ui/lang-switch';
import { ResultOverlay } from './ui/result-overlay';

/** The keys that rotate a ship — R on the Latin, Cyrillic and Hebrew layouts. */
const ROTATE_KEYS = new Set(['r', 'к', 'ר']);

@Component({
  selector: 'app-root',
  imports: [BoardGrid, DeployPanel, BattlePanel, ResultOverlay, LangSwitch],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '(document:keydown)': 'onKey($event)',
  },
})
export class App {
  protected readonly store = inject(GameStore);
  protected readonly i18n = inject(I18n);

  protected readonly deploying = computed(() => this.store.phase() === 'deploy');
  protected readonly fighting = computed(() => this.store.phase() !== 'deploy');
  protected readonly surveyed = computed(() => this.store.phase() === 'over');

  /** The splash shows on whichever chart was fired at. */
  protected readonly enemySplash = computed(() => {
    const s = this.store.splash();
    return s && s.side === 'player' ? s : null;
  });

  protected readonly homeSplash = computed(() => {
    const s = this.store.splash();
    return s && s.side === 'enemy' ? s : null;
  });

  protected readonly turnWord = computed(() => {
    if (this.store.phase() === 'deploy') return this.i18n.t('turn.deploy');
    if (this.store.phase() === 'over') return this.i18n.t('turn.over');
    return this.i18n.t(this.store.turn() === 'player' ? 'turn.yours' : 'turn.theirs');
  });

  protected onKey(event: KeyboardEvent): void {
    if (!this.deploying()) return;
    if (!ROTATE_KEYS.has(event.key.toLowerCase())) return;
    event.preventDefault();
    this.store.rotate();
  }
}
