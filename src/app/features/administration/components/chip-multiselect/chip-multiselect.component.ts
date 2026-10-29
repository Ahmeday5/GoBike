import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';

export interface ChipOption {
  value: string;
  label: string;
  icon?: string;
  /** Small secondary text (e.g. the raw role name of a custom role). */
  hint?: string;
}

/** Multi-select as toggleable checkbox chips (roles of a user, etc.). */
@Component({
  selector: 'app-chip-multiselect',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="cms" role="group" [attr.aria-label]="label()">
      @for (o of options(); track o.value) {
        <label class="cms__chip" [class.cms__chip--on]="value().includes(o.value)">
          <input
            type="checkbox"
            class="cms__input"
            [checked]="value().includes(o.value)"
            [disabled]="disabled()"
            (change)="toggle(o.value)"
          />
          <app-icon
            [name]="value().includes(o.value) ? 'check' : (o.icon ?? 'shield')"
            [size]="14"
          />
          <span>{{ o.label }}</span>
          @if (o.hint) {
            <small class="cms__hint ltr">{{ o.hint }}</small>
          }
        </label>
      } @empty {
        <span class="muted cms__empty">لا توجد خيارات</span>
      }
    </div>
  `,
  styles: `
    .cms {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.375rem;
    }
    .cms__chip {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.8125rem;
      border: 1px solid var(--brd);
      border-radius: var(--r-full);
      background: var(--bg2);
      color: var(--txt2);
      font-size: var(--fs-xs);
      font-weight: 600;
      cursor: pointer;
      user-select: none;
      transition:
        background var(--dur-2),
        color var(--dur-2),
        border-color var(--dur-2),
        transform var(--dur-3) var(--ease-spring);
      &:hover {
        border-color: var(--primary);
        color: var(--txt);
      }
      &:active {
        transform: scale(0.96);
      }
      &:has(.cms__input:focus-visible) {
        box-shadow: 0 0 0 3px var(--primary-ring);
      }
      &:has(.cms__input:disabled) {
        opacity: 0.6;
        cursor: not-allowed;
      }
      &--on {
        border-color: var(--primary);
        background: var(--primary-soft);
        color: var(--primary);
        app-icon {
          animation: pop-in var(--dur-3) var(--ease-spring);
        }
      }
    }
    .cms__input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
    .cms__hint {
      font-weight: 400;
      color: var(--txt3);
    }
    .cms__empty {
      font-size: var(--fs-xs);
    }
  `,
})
export class ChipMultiselectComponent {
  readonly options = input<readonly ChipOption[]>([]);
  readonly value = input<readonly string[]>([]);
  readonly label = input('اختيارات');
  readonly disabled = input(false);
  readonly valueChange = output<string[]>();

  protected toggle(v: string): void {
    const current = this.value();
    const next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
    // Keep option order so the payload is stable; never drop values we have no option for.
    const known = this.options().map((o) => o.value);
    this.valueChange.emit([
      ...known.filter((x) => next.includes(x)),
      ...next.filter((x) => !known.includes(x)),
    ]);
  }
}
