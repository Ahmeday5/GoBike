import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { environment } from '@env/environment';

export type LogoVariant = 'wordmark' | 'mark';

/** Intrinsic aspect ratios of the generated assets (width / height). */
const ASSETS: Record<LogoVariant, { src: string; ratio: number }> = {
  wordmark: { src: 'assets/img/logo-wordmark.png', ratio: 600 / 204 },
  mark: { src: 'assets/img/logo-mark.png', ratio: 160 / 78 },
};

/**
 * The brand logo. `wordmark` is the full "GO BIKY" sticker; `mark` is the
 * "GO" glyph alone, for tight spaces (collapsed sidebar). Explicit width and
 * height reserve the box before the image loads, so nothing shifts.
 */
@Component({
  selector: 'app-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <img
      [src]="asset().src"
      [alt]="alt"
      [height]="height()"
      [width]="width()"
      [style.height.rem]="height() / 16"
      decoding="async"
      draggable="false"
    />
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }
    img {
      /* Height comes from the inline rem style; width follows the aspect ratio.
         (The width/height attributes only reserve space before the image loads.) */
      width: auto;
      max-width: 100%;
      user-select: none;
    }
  `,
})
export class LogoComponent {
  readonly variant = input<LogoVariant>('wordmark');
  /** Design height in px at UI scale 1; rendered in rem so it follows `--ui-scale`. */
  readonly height = input(40);

  protected readonly asset = computed(() => ASSETS[this.variant()]);
  protected readonly width = computed(() => Math.round(this.height() * this.asset().ratio));
  protected readonly alt = environment.appName;
}
