import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  permissionGroupKey,
  permissionGroupMeta,
  permissionLabel,
} from '../../models/permission-labels';

interface PermissionItem {
  name: string;
  label: string;
  on: boolean;
  /** Present on one side only (newly ticked / unticked) — highlighted until saved. */
  changed: boolean;
}

interface PermissionGroup {
  key: string;
  label: string;
  icon: string;
  items: PermissionItem[];
  onCount: number;
}

const GROUP_ORDER = Object.keys(PERMISSION_GROUPS);
const PERMISSION_ORDER = Object.keys(PERMISSION_LABELS);
const rank = (list: string[], v: string) => {
  const i = list.indexOf(v);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
};

/**
 * Permission checkboxes grouped by area (gps, motorcycles, …) with Arabic
 * labels, a per-group "all" toggle and a highlight on unsaved changes.
 * Purely presentational: the page owns the draft.
 */
@Component({
  selector: 'app-permission-matrix',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="pm">
      @for (g of groups(); track g.key; let gi = $index) {
        <section class="pm__group anim-fade-up" [style.--i]="gi">
          <header class="pm__head">
            <span class="pm__icon"><app-icon [name]="g.icon" [size]="16" /></span>
            <h3 class="pm__title">{{ g.label }}</h3>
            <span class="pm__count">{{ g.onCount }}/{{ g.items.length }}</span>
            <label class="pm__all">
              <input
                type="checkbox"
                class="form-check-input"
                [checked]="g.onCount === g.items.length"
                [indeterminate]="g.onCount > 0 && g.onCount < g.items.length"
                [disabled]="readonly()"
                (change)="toggleGroup(g, $any($event.target).checked)"
              />
              <span>الكل</span>
            </label>
          </header>
          <ul class="pm__list">
            @for (p of g.items; track p.name) {
              <li>
                <label
                  class="pm__item"
                  [class.pm__item--on]="p.on"
                  [class.pm__item--changed]="p.changed"
                >
                  <input
                    type="checkbox"
                    class="form-check-input"
                    [checked]="p.on"
                    [disabled]="readonly()"
                    (change)="toggle(p.name, $any($event.target).checked)"
                  />
                  <span class="pm__text">
                    <span>{{ p.label }}</span>
                    <code class="pm__code ltr">{{ p.name }}</code>
                  </span>
                  @if (p.changed) {
                    <span
                      class="pm__dot"
                      title="تغيير غير محفوظ"
                      aria-label="تغيير غير محفوظ"
                    ></span>
                  }
                </label>
              </li>
            }
          </ul>
        </section>
      }
    </div>
  `,
  styles: `
    .pm {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
      gap: 0.75rem;
    }
    .pm__group {
      border: 1px solid var(--brd);
      border-radius: var(--rl);
      background: var(--bg);
      overflow: hidden;
      animation-delay: calc(var(--i, 0) * 30ms);
    }
    .pm__head {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 0.75rem;
      border-bottom: 1px solid var(--brd);
      background: var(--bg2);
    }
    .pm__icon {
      width: 1.875rem;
      height: 1.875rem;
      display: grid;
      place-items: center;
      border-radius: 0.5rem;
      color: var(--primary);
      background: var(--primary-soft);
    }
    .pm__title {
      margin: 0;
      font-size: var(--fs-sm);
      font-weight: 700;
    }
    .pm__count {
      font-size: var(--fs-xs);
      color: var(--txt3);
      font-variant-numeric: tabular-nums;
    }
    .pm__all {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      margin: 0;
      margin-inline-start: auto;
      font-size: var(--fs-xs);
      cursor: pointer;
      .form-check-input {
        float: none;
        margin: 0;
      }
    }
    .pm__list {
      margin: 0;
      padding: 0.375rem;
      list-style: none;
    }
    .pm__item {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      padding: 0.5rem;
      border-radius: var(--r);
      cursor: pointer;
      transition: background var(--dur-2);
      &:hover {
        background: var(--bg3);
      }
      .form-check-input {
        flex-shrink: 0;
        margin: 0.15rem 0 0;
      }
      &:has(.form-check-input:disabled) {
        cursor: default;
      }
    }
    .pm__item--changed {
      background: var(--am-l);
      &:hover {
        background: var(--am-l);
      }
    }
    .pm__text {
      display: grid;
      gap: 0.125rem;
      flex: 1;
      min-width: 0;
      font-size: var(--fs-sm);
    }
    .pm__code {
      justify-self: start;
      font-size: 0.6875rem;
      color: var(--txt3);
      background: none;
      padding: 0;
    }
    .pm__item--on .pm__text > span {
      font-weight: 600;
    }
    .pm__dot {
      width: 0.5rem;
      height: 0.5rem;
      flex-shrink: 0;
      margin-top: 0.4rem;
      border-radius: 50%;
      background: var(--am);
      animation: pop-in var(--dur-3) var(--ease-spring);
    }
  `,
})
export class PermissionMatrixComponent {
  /** Every permission the backend knows (`GET /roles/permissions`). */
  readonly permissions = input<readonly string[]>([]);
  /** Current draft selection. */
  readonly value = input<readonly string[]>([]);
  /** Saved selection — differences are highlighted. */
  readonly original = input<readonly string[]>([]);
  readonly readonly = input(false);
  readonly valueChange = output<string[]>();

  protected readonly groups = computed<PermissionGroup[]>(() => {
    const on = new Set(this.value());
    const before = new Set(this.original());
    // Union, so a permission the role holds but the catalog lacks still shows.
    const all = [...new Set([...this.permissions(), ...this.original(), ...this.value()])];
    const byGroup = new Map<string, string[]>();
    for (const p of all) {
      const key = permissionGroupKey(p);
      byGroup.set(key, [...(byGroup.get(key) ?? []), p]);
    }
    return [...byGroup.entries()]
      .sort(([a], [b]) => rank(GROUP_ORDER, a) - rank(GROUP_ORDER, b) || a.localeCompare(b))
      .map(([key, names]) => {
        const meta = permissionGroupMeta(key);
        const items = names
          .sort(
            (a, b) => rank(PERMISSION_ORDER, a) - rank(PERMISSION_ORDER, b) || a.localeCompare(b),
          )
          .map((name) => ({
            name,
            label: permissionLabel(name),
            on: on.has(name),
            changed: on.has(name) !== before.has(name),
          }));
        return {
          key,
          label: meta.label,
          icon: meta.icon,
          items,
          onCount: items.filter((i) => i.on).length,
        };
      });
  });

  protected toggle(name: string, checked: boolean): void {
    const next = new Set(this.value());
    if (checked) next.add(name);
    else next.delete(name);
    this.valueChange.emit([...next]);
  }

  protected toggleGroup(g: PermissionGroup, checked: boolean): void {
    const next = new Set(this.value());
    for (const p of g.items) {
      if (checked) next.add(p.name);
      else next.delete(p.name);
    }
    this.valueChange.emit([...next]);
  }
}
