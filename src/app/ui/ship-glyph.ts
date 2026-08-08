import { Component, computed, input } from '@angular/core';

interface DeckBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const U = 20; // viewBox units per cell

/**
 * A ship's silhouette, drawn from its number of decks: a patrol boat is a dot,
 * a battleship four decks with turrets. Bow to the right; vertical is a rotation.
 */
@Component({
  selector: 'app-ship-glyph',
  template: `
    <svg [attr.viewBox]="viewBox()" role="presentation" focusable="false">
      <path class="hull" [attr.d]="hull()" />
      <line class="waterline" [attr.x1]="2.5" y1="10" [attr.x2]="length() - 4" y2="10" />
      @for (b of decks(); track $index) {
        <rect class="deck" [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="0.6" />
      }
      @if (size() >= 3) {
        <line class="mast" [attr.x1]="mastX()" y1="2.5" [attr.x2]="mastX()" y2="8" />
      }
      @if (size() >= 2) {
        <circle class="turret" [attr.cx]="length() - 6" cy="10" r="1.9" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .hull {
      fill: var(--glyph-fill, rgba(20, 56, 79, 0.9));
      stroke: var(--glyph-stroke, #14384f);
      stroke-width: var(--glyph-weight, 1.1);
      stroke-linejoin: round;
    }
    .waterline,
    .mast {
      stroke: var(--glyph-detail, rgba(221, 211, 183, 0.55));
      stroke-width: 0.8;
      stroke-linecap: round;
    }
    .deck {
      fill: var(--glyph-detail, rgba(221, 211, 183, 0.55));
    }
    .turret {
      fill: none;
      stroke: var(--glyph-detail, rgba(221, 211, 183, 0.55));
      stroke-width: 0.8;
    }
  `,
})
export class ShipGlyph {
  readonly size = input.required<number>();

  protected readonly length = computed(() => this.size() * U);
  protected readonly viewBox = computed(() => `0 0 ${this.length()} ${U}`);
  protected readonly mastX = computed(() => this.length() * 0.42);

  protected readonly hull = computed(() => {
    const l = this.length();
    const stern = 2;
    const bow = l - 2;
    const shoulder = bow - Math.min(7, l * 0.34);
    return [
      `M ${stern} 5.4`,
      `H ${shoulder}`,
      `Q ${bow} 10 ${shoulder} 14.6`,
      `H ${stern}`,
      `Q ${stern - 1.4} 10 ${stern} 5.4`,
      'Z',
    ].join(' ');
  });

  protected readonly decks = computed<DeckBox[]>(() => {
    const n = this.size();
    const l = this.length();
    if (n === 1) return [{ x: l * 0.34, y: 8.2, w: l * 0.3, h: 3.6 }];
    if (n === 2) return [{ x: l * 0.3, y: 7.4, w: l * 0.22, h: 5.2 }];
    if (n === 3)
      return [
        { x: l * 0.26, y: 6.8, w: l * 0.18, h: 6.4 },
        { x: l * 0.5, y: 8, w: l * 0.12, h: 4 },
      ];
    return [
      { x: l * 0.2, y: 6.4, w: l * 0.14, h: 7.2 },
      { x: l * 0.38, y: 7.4, w: l * 0.1, h: 5.2 },
      { x: l * 0.54, y: 8, w: l * 0.12, h: 4 },
    ];
  });
}
