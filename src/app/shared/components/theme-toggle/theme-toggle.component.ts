import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ThemeService } from '@core/services/theme.service';
import { IconComponent } from '../icon/icon.component';

/**
 * Light/dark switch. Both icons are always rendered and cross-rotate, so
 * the swap animates instead of popping.
 */
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <button
      type="button"
      class="tt"
      [class.tt--dark]="isDark()"
      (click)="theme.toggle()"
      [attr.aria-label]="label()"
      [title]="label()"
    >
      <app-icon class="tt__icon tt__sun" name="sun" [size]="18" />
      <app-icon class="tt__icon tt__moon" name="moon" [size]="18" />
    </button>
  `,
  styles: `
    .tt {
      position: relative;
      width: 2.5rem;
      height: 2.5rem;
      display: grid;
      place-items: center;
      border: 1px solid var(--brd);
      border-radius: var(--r-full);
      background: var(--bg2);
      color: var(--txt2);
      cursor: pointer;
      overflow: hidden;
      transition:
        background var(--dur-2),
        color var(--dur-2),
        border-color var(--dur-2),
        transform var(--dur-3) var(--ease-spring),
        box-shadow var(--dur-2);

      &:hover {
        color: var(--primary);
        border-color: var(--primary-soft-2);
        background: var(--primary-soft);
        transform: rotate(-12deg) scale(1.06);
      }
      &:active {
        transform: scale(0.92);
      }
    }
    .tt__icon {
      position: absolute;
      transition:
        transform var(--dur-4) var(--ease-spring),
        opacity var(--dur-3) var(--ease-out);
    }
    .tt__moon {
      opacity: 0;
      transform: rotate(-90deg) scale(0.4);
    }
    .tt--dark {
      .tt__sun {
        opacity: 0;
        transform: rotate(90deg) scale(0.4);
      }
      .tt__moon {
        opacity: 1;
        transform: none;
      }
    }
  `,
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly isDark = computed(() => this.theme.theme() === 'dark');
  protected readonly label = computed(() =>
    this.isDark() ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن',
  );
}
