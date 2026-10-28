import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@core/auth/services/auth.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SETTINGS_SECTIONS } from '../../models/settings-sections';

/** Horizontal pill navigation between settings sections — only the ones the user can open. */
@Component({
  selector: 'app-settings-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    @if (sections().length > 1) {
      <nav class="snav no-print" aria-label="أقسام الإعدادات">
        @for (s of sections(); track s.path; let i = $index) {
          <a
            class="snav__pill"
            [routerLink]="s.url"
            routerLinkActive="snav__pill--active"
            ariaCurrentWhenActive="page"
            [style.--i]="i"
          >
            <app-icon [name]="s.icon" [size]="16" />
            <span>{{ s.label }}</span>
          </a>
        }
      </nav>
    }
  `,
  styles: `
    .snav {
      display: flex;
      gap: 0.375rem;
      margin-bottom: 1.25rem;
      padding: 0.3125rem;
      overflow-x: auto;
      border: 1px solid var(--brd);
      border-radius: var(--r-full);
      background: var(--bg2);
      box-shadow: var(--shadow-xs);
      scrollbar-width: none;
      animation: fade-down var(--dur-4) var(--ease-out) both;
      &::-webkit-scrollbar {
        display: none;
      }
    }
    .snav__pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
      padding: 0.5rem 1rem;
      border-radius: var(--r-full);
      color: var(--txt2);
      font-size: var(--fs-sm);
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
      animation: fade-in var(--dur-3) var(--ease-out) both;
      animation-delay: calc(var(--i, 0) * 40ms);
      transition:
        background var(--dur-2),
        color var(--dur-2),
        box-shadow var(--dur-2),
        transform var(--dur-3) var(--ease-spring);

      &:hover:not(.snav__pill--active) {
        background: var(--bg3);
        color: var(--txt);
        transform: translateY(-1px);
      }
      &:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--primary-ring);
      }
      &--active {
        background: var(--primary-gradient);
        color: var(--on-primary);
        box-shadow: var(--shadow-brand);
      }
    }
  `,
})
export class SettingsNavComponent {
  private readonly auth = inject(AuthService);

  protected readonly sections = computed(() => {
    this.auth.permissionSet(); // re-evaluate when permissions change
    return SETTINGS_SECTIONS.filter((s) => this.auth.hasPermission(s.permission));
  });
}
