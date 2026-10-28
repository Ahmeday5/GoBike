import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cairoToday } from '@core/utils/cairo-time.util';
import { ChipComponent } from '@shared/components/chip/chip.component';
import { CairoDatePipe } from '@shared/pipes/format.pipes';
import { LICENSE_WARN_DAYS } from '../../models/driver.models';

const DAY_MS = 86_400_000;

/** Licence expiry date with a warning once it is expired or due within 30 days. */
@Component({
  selector: 'app-license-expiry',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChipComponent, CairoDatePipe],
  template: `
    @if (date(); as d) {
      <span class="le">
        <span [class.le__date--bad]="state() === 'expired'">{{ d | cairoDate: 'date' }}</span>
        @switch (state()) {
          @case ('expired') {
            <app-chip tone="danger" icon="alert" [small]="true">منتهية</app-chip>
          }
          @case ('soon') {
            <app-chip tone="warning" icon="clock" [small]="true">
              {{ daysLeft() === 0 ? 'تنتهي اليوم' : 'باقي ' + daysLeft() + ' يوم' }}
            </app-chip>
          }
        }
      </span>
    } @else {
      <span class="muted">—</span>
    }
  `,
  styles: `
    .le {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.375rem;
    }
    .le__date--bad {
      color: var(--re);
      font-weight: 600;
    }
  `,
})
export class LicenseExpiryComponent {
  /** DateOnly `yyyy-MM-dd` (a full ISO string is tolerated). */
  readonly date = input<string | null | undefined>(null);

  protected readonly daysLeft = computed(() => {
    const d = this.date()?.slice(0, 10);
    if (!d) return null;
    const diff = Date.parse(`${d}T00:00:00Z`) - Date.parse(`${cairoToday()}T00:00:00Z`);
    return Number.isFinite(diff) ? Math.round(diff / DAY_MS) : null;
  });

  protected readonly state = computed<'expired' | 'soon' | 'ok'>(() => {
    const n = this.daysLeft();
    if (n === null) return 'ok';
    if (n < 0) return 'expired';
    return n <= LICENSE_WARN_DAYS ? 'soon' : 'ok';
  });
}
