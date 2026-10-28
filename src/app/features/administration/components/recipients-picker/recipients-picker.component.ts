import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ALERT_RECIPIENT } from '@core/constants/enums';
import { IconComponent } from '@shared/components/icon/icon.component';
import { RECIPIENT_CHOICES } from '../../models/policy.models';

const ICONS: Record<string, string> = {
  Driver: 'user',
  Admin: 'shield',
  TechnicalSupport: 'map-pin',
  MaintenanceOfficer: 'wrench',
  Accountant: 'cash',
};

/** Multi-select checkbox chips for alert recipients. Empty selection = nobody ("None"). */
@Component({
  selector: 'app-recipients-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="rp" role="group" [attr.aria-label]="label()">
      @for (r of choices; track r) {
        <label class="rp__chip" [class.rp__chip--on]="value().includes(r)">
          <input
            type="checkbox"
            class="rp__input"
            [checked]="value().includes(r)"
            [disabled]="disabled()"
            (change)="toggle(r)"
          />
          <app-icon [name]="value().includes(r) ? 'check' : icons[r]" [size]="14" />
          {{ labels[r].label }}
        </label>
      }
      @if (!value().length) {
        <span class="rp__none muted">لن يُرسل هذا التنبيه لأحد</span>
      }
    </div>
  `,
  styles: `
    .rp {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.375rem;
    }
    .rp__chip {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.3125rem 0.75rem;
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
      &:has(.rp__input:focus-visible) {
        box-shadow: 0 0 0 3px var(--primary-ring);
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
    .rp__input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
    .rp__none {
      font-size: var(--fs-xs);
    }
  `,
})
export class RecipientsPickerComponent {
  readonly value = input<readonly string[]>([]);
  readonly label = input('المستلمون');
  readonly disabled = input(false);
  readonly valueChange = output<string[]>();

  protected readonly choices = RECIPIENT_CHOICES;
  protected readonly labels = ALERT_RECIPIENT;
  protected readonly icons = ICONS;

  protected toggle(r: string): void {
    const current = this.value();
    const next = current.includes(r) ? current.filter((x) => x !== r) : [...current, r];
    this.valueChange.emit(RECIPIENT_CHOICES.filter((c) => next.includes(c)));
  }
}
