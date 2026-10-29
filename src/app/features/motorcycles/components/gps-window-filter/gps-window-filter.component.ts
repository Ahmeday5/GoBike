import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { cairoNowInput, cairoInputToUtc, utcToCairoInput } from '@core/utils/cairo-time.util';
import { IconComponent } from '@shared/components/icon/icon.component';
import { GpsWindow, GpsWindowQuery, MAX_GPS_WINDOW_HOURS } from '../../utils/gps-window';

const PRESETS = [
  { hours: 1, label: 'آخر ساعة' },
  { hours: 6, label: '6 ساعات' },
  { hours: 24, label: '24 ساعة' },
  { hours: 48, label: '48 ساعة' },
] as const;

/**
 * From/to (Cairo time) for GPS history, with quick presets. Enforces the
 * API's 48-hour limit on the client: an invalid window is reported, not sent.
 */
@Component({
  selector: 'app-gps-window-filter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="filters gw" role="search">
      <label class="gw__field">
        <span class="gw__label">من</span>
        <input
          type="datetime-local"
          class="form-control ltr"
          [value]="window().fromInput"
          [max]="window().toInput"
          (change)="onInput('from', $event)"
        />
      </label>
      <label class="gw__field">
        <span class="gw__label">إلى</span>
        <input
          type="datetime-local"
          class="form-control ltr"
          [value]="window().toInput"
          [min]="window().fromInput"
          (change)="onInput('to', $event)"
        />
      </label>
      <div class="gw__presets" role="group" aria-label="فترات سريعة">
        @for (p of presets; track p.hours) {
          <button type="button" class="btn btn-sm btn-ghost" (click)="preset(p.hours)">
            {{ p.label }}
          </button>
        }
      </div>
      <span class="filters__spacer"></span>
      <span class="gw__hint muted">
        <app-icon name="clock" [size]="12" />
        بتوقيت القاهرة · بحد أقصى {{ maxHours }} ساعة
      </span>
    </div>
    @if (window().error; as err) {
      <div class="alert alert-warning" role="alert">{{ err }}</div>
    }
  `,
  styles: `
    .gw__field {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      margin: 0;
    }
    .gw__label {
      font-size: var(--fs-sm);
      font-weight: 600;
      color: var(--txt2);
    }
    .gw .form-control {
      min-width: 13rem;
    }
    .gw__presets {
      display: flex;
      flex-wrap: wrap;
      gap: 0.125rem;
    }
    .gw__hint {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: var(--fs-xs);
    }
  `,
})
export class GpsWindowFilterComponent {
  readonly window = input.required<GpsWindow>();
  readonly changed = output<Partial<GpsWindowQuery>>();

  protected readonly presets = PRESETS;
  protected readonly maxHours = MAX_GPS_WINDOW_HOURS;

  protected onInput(key: keyof GpsWindowQuery, event: Event): void {
    this.emit({ [key]: (event.target as HTMLInputElement).value });
  }

  private emit(change: Partial<GpsWindowQuery>): void {
    // Pin both ends in the URL so the window no longer depends on page-load time.
    this.changed.emit({ from: this.window().fromInput, to: this.window().toInput, ...change });
  }

  protected preset(hours: number): void {
    const to = cairoNowInput();
    const toUtc = cairoInputToUtc(to);
    const from = toUtc ? utcToCairoInput(new Date(Date.parse(toUtc) - hours * 3_600_000)) : '';
    this.changed.emit({ from, to });
  }
}
