import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  /** Counter shown next to the label (hidden when 0/undefined). */
  badge?: number | null;
}

/**
 * Tab strip. The parent owns the active id (keep it in URL state so refresh
 * stays on the same tab) and renders the panel with `@switch`.
 *
 *   <app-tabs [tabs]="tabs" [active]="f.tab" (activeChange)="filters.patch({ tab: $event })" />
 */
@Component({
  selector: 'app-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="tabs" role="tablist">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button"
          role="tab"
          class="tabs__tab"
          [class.tabs__tab--active]="tab.id === active()"
          [attr.aria-selected]="tab.id === active()"
          (click)="activeChange.emit(tab.id)"
        >
          @if (tab.icon) {
            <app-icon [name]="tab.icon" [size]="16" />
          }
          <span>{{ tab.label }}</span>
          @if (tab.badge) {
            <span class="tabs__badge">{{ tab.badge }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: `
    .tabs {
      display: flex;
      gap: 0.25rem;
      margin-bottom: 1.25rem;
      padding: 0.25rem;
      overflow-x: auto;
      border: 1px solid var(--brd);
      border-radius: var(--rl);
      background: var(--bg2);
      scrollbar-width: none;
    }
    .tabs__tab {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
      padding: 0.5rem 0.875rem;
      border: none;
      border-radius: var(--r);
      background: transparent;
      color: var(--txt2);
      font: inherit;
      font-size: var(--fs-sm);
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      transition:
        background var(--dur-2),
        color var(--dur-2);

      &:hover:not(.tabs__tab--active) {
        background: var(--bg3);
        color: var(--txt);
      }
      &--active {
        background: var(--primary-soft);
        color: var(--primary);
        box-shadow: inset 0 0 0 1px var(--primary-soft-2);
      }
    }
    .tabs__badge {
      min-width: 1.25rem;
      padding: 0 0.375rem;
      border-radius: var(--r-full);
      background: var(--primary);
      color: #fff;
      font-size: 0.6875rem;
      line-height: 1.25rem;
      text-align: center;
      animation: pop-in var(--dur-4) var(--ease-spring);
    }
  `,
})
export class TabsComponent {
  readonly tabs = input.required<readonly TabItem[]>();
  readonly active = input.required<string>();
  readonly activeChange = output<string>();
}
