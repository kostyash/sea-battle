import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameStore } from './core/game-store';
import { BattlePanel } from './ui/battle-panel';
import { BoardGrid } from './ui/board-grid';
import { DeployPanel } from './ui/deploy-panel';
import { ResultOverlay } from './ui/result-overlay';

@Component({
  selector: 'app-root',
  imports: [BoardGrid, DeployPanel, BattlePanel, ResultOverlay],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '(document:keydown)': 'onKey($event)',
  },
})
export class App {
  protected readonly store = inject(GameStore);

  protected readonly deploying = computed(() => this.store.phase() === 'deploy');
  protected readonly fighting = computed(() => this.store.phase() !== 'deploy');
  protected readonly surveyed = computed(() => this.store.phase() === 'over');

  /** Всплеск показывается на той карте, по которой стреляли. */
  protected readonly enemySplash = computed(() => {
    const s = this.store.splash();
    return s && s.side === 'player' ? s : null;
  });

  protected readonly homeSplash = computed(() => {
    const s = this.store.splash();
    return s && s.side === 'enemy' ? s : null;
  });

  protected readonly turnWord = computed(() => {
    if (this.store.phase() === 'deploy') return 'Расстановка';
    if (this.store.phase() === 'over') return 'Бой окончен';
    return this.store.turn() === 'player' ? 'Ваш ход' : 'Ход противника';
  });

  protected onKey(event: KeyboardEvent): void {
    if (!this.deploying()) return;
    const k = event.key.toLowerCase();
    if (k === 'r' || k === 'к') {
      event.preventDefault();
      this.store.rotate();
    }
  }
}
