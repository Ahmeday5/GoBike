import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { OIL_LEVEL, OilLevel } from '@core/constants/enums';
import { EnumChipComponent } from '@shared/components/chip/chip.component';
import { KmPipe } from '@shared/pipes/format.pipes';

/** The fields of the oil cycle the bar needs (overview.oilStatus and maintenance status share them). */
export interface OilCycle {
  kmSinceOilChange?: number | null;
  firstWarningKm?: number | null;
  secondWarningKm?: number | null;
  criticalKm?: number | null;
  maxKm?: number | null;
  currentLevel?: OilLevel | null;
}

interface Zone {
  from: number;
  to: number;
  tone: 'ok' | 'warn' | 'warn2' | 'crit' | 'over';
}

/**
 * Distance since the last accepted oil change, on a bar with the policy's
 * thresholds (defaults 400 / 450 / 500 / 600 km). The scale runs 20 % past
 * the maximum so the overdue (fined) stretch is visible too.
 */
@Component({
  selector: 'app-oil-status-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EnumChipComponent, KmPipe],
  template: `
    @let v = view();
    <div class="ob">
      <div class="ob__head">
        <div>
          <span class="ob__value" [class]="'ob__value oil-' + v.level">{{ v.km | km }}</span>
          <span class="ob__of">من {{ v.max | km }}</span>
        </div>
        <app-enum-chip [map]="OIL" [value]="v.level" />
      </div>

      <div
        class="ob__track"
        role="meter"
        aria-label="المسافة منذ آخر تغيير زيت"
        [attr.aria-valuenow]="v.km"
        aria-valuemin="0"
        [attr.aria-valuemax]="v.max"
      >
        @for (z of v.zones; track z.from) {
          <span
            class="ob__zone"
            [class]="'ob__zone ob__zone--' + z.tone"
            [style.inset-inline-start.%]="pct(z.from)"
            [style.width.%]="pct(z.to) - pct(z.from)"
          ></span>
        }
        <span class="ob__fill" [style.width.%]="pct(v.km)"></span>
        <span class="ob__pin" [style.inset-inline-start.%]="pct(v.km)">
          <span class="ob__pin-dot" [class]="'ob__pin-dot ob__pin-dot--' + v.level"></span>
        </span>
      </div>

      <div class="ob__ticks" aria-hidden="true">
        <span class="ob__tick" style="inset-inline-start: 0">0</span>
        @for (t of v.ticks; track t.km) {
          <span class="ob__tick" [style.inset-inline-start.%]="pct(t.km)">
            <b class="ltr">{{ t.km }}</b>
            <small>{{ t.label }}</small>
          </span>
        }
      </div>
    </div>
  `,
  styles: `
    .ob__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    .ob__value {
      font-size: var(--fs-2xl);
      font-weight: 800;
      line-height: 1;
    }
    .ob__of {
      margin-inline-start: 0.375rem;
      color: var(--txt3);
      font-size: var(--fs-sm);
    }
    .ob__track {
      position: relative;
      height: 0.875rem;
      border-radius: var(--r-full);
      background: var(--bg3);
      overflow: visible;
    }
    .ob__zone {
      position: absolute;
      inset-block: 0;
      opacity: 0.28;
      &:first-child {
        border-start-start-radius: var(--r-full);
        border-end-start-radius: var(--r-full);
      }
      &:last-of-type {
        border-start-end-radius: var(--r-full);
        border-end-end-radius: var(--r-full);
      }
      &--ok {
        background: var(--gr);
      }
      &--warn {
        background: color-mix(in srgb, var(--am) 70%, var(--gr));
      }
      &--warn2 {
        background: var(--am);
      }
      &--crit {
        background: color-mix(in srgb, var(--am) 45%, var(--re));
      }
      &--over {
        background: var(--re);
      }
    }
    .ob__fill {
      position: absolute;
      inset-block: 0.1875rem;
      inset-inline-start: 0.1875rem;
      max-width: calc(100% - 0.375rem);
      border-radius: var(--r-full);
      background: linear-gradient(
        to left,
        var(--gr),
        var(--am) 70%,
        color-mix(in srgb, var(--am) 45%, var(--re)) 82%,
        var(--re)
      );
      background-size: var(--ob-scale, 100%) 100%;
      transform-origin: right;
      animation: ob-grow 1s var(--ease-out) both;
    }
    .ob__pin {
      position: absolute;
      top: 50%;
      transform: translate(50%, -50%);
      animation: ob-pin 1s var(--ease-out) both;
    }
    .ob__pin-dot {
      display: block;
      width: 1.375rem;
      height: 1.375rem;
      border-radius: 50%;
      border: 3px solid var(--bg2);
      background: var(--gr);
      box-shadow: var(--shadow-md);
      &--FirstWarning,
      &--SecondWarning {
        background: var(--am);
      }
      &--Critical {
        background: color-mix(in srgb, var(--am) 45%, var(--re));
      }
      &--Overdue {
        background: var(--re);
        animation: pop-in var(--dur-4) var(--ease-spring) 1s both;
      }
    }
    .ob__ticks {
      position: relative;
      height: 2.25rem;
      margin-top: 0.375rem;
    }
    .ob__tick {
      position: absolute;
      top: 0;
      display: grid;
      justify-items: center;
      transform: translateX(50%);
      color: var(--txt3);
      font-size: 0.6875rem;
      line-height: 1.3;
      white-space: nowrap;
      b {
        color: var(--txt2);
        font-weight: 700;
      }
      &::before {
        content: '';
        width: 1px;
        height: 0.375rem;
        margin-bottom: 0.125rem;
        background: var(--brd2);
      }
    }
    @keyframes ob-grow {
      from {
        transform: scaleX(0);
      }
    }
    @keyframes ob-pin {
      from {
        inset-inline-start: 0;
        opacity: 0;
      }
    }
    @media (max-width: 575.98px) {
      .ob__tick small {
        display: none;
      }
    }
  `,
})
export class OilStatusBarComponent {
  readonly cycle = input.required<OilCycle>();

  protected readonly OIL = OIL_LEVEL;

  protected readonly view = computed(() => {
    const c = this.cycle();
    const first = c.firstWarningKm ?? 400;
    const second = c.secondWarningKm ?? 450;
    const critical = c.criticalKm ?? 500;
    const max = c.maxKm ?? 600;
    const km = Math.max(0, c.kmSinceOilChange ?? 0);
    const end = Math.max(max * 1.2, km);
    const zones: Zone[] = [
      { from: 0, to: first, tone: 'ok' },
      { from: first, to: second, tone: 'warn' },
      { from: second, to: critical, tone: 'warn2' },
      { from: critical, to: max, tone: 'crit' },
      { from: max, to: end, tone: 'over' },
    ];
    return {
      km,
      max,
      end,
      level: c.currentLevel ?? levelFor(km, first, second, critical, max),
      zones,
      ticks: [
        { km: first, label: 'تنبيه أول' },
        { km: second, label: 'تنبيه ثانٍ' },
        { km: critical, label: 'حرج' },
        { km: max, label: 'الحد الأقصى' },
      ],
    };
  });

  protected pct(km: number): number {
    return Math.min(100, Math.max(0, (km / this.view().end) * 100));
  }
}

function levelFor(km: number, a: number, b: number, c: number, max: number): OilLevel {
  if (km >= max) return 'Overdue';
  if (km >= c) return 'Critical';
  if (km >= b) return 'SecondWarning';
  if (km >= a) return 'FirstWarning';
  return 'None';
}
