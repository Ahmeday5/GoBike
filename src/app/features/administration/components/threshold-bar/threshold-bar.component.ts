import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { OIL_LEVEL } from '@core/constants/enums';
import { NumberPipe } from '@shared/pipes/format.pipes';

interface Segment {
  key: string;
  from: number;
  to: number;
  tone: string;
}

interface Marker {
  key: string;
  at: number;
  km: number;
  label: string;
  tone: string;
}

const num = (v: number | null | undefined): number => (typeof v === 'number' && v > 0 ? v : 0);

/**
 * Visual oil-counter scale: four colored zones with a marker at each
 * threshold (400 / 450 / 500 / 600 by default). Leaves headroom past the
 * maximum so the "overdue" zone is visible. Used live in the policy form and
 * read-only on policy cards.
 */
@Component({
  selector: 'app-threshold-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, NumberPipe],
  template: `
    <div
      class="tb"
      [class.tb--invalid]="!valid()"
      [class.tb--compact]="compact()"
      role="img"
      [attr.aria-label]="ariaLabel()"
    >
      @if (!compact()) {
        <!-- Alternate labels above/below so close thresholds never overlap. -->
        <div class="tb__labels tb__labels--top">
          @for (m of markers(); track m.key; let odd = $odd) {
            @if (odd) {
              <ng-container *ngTemplateOutlet="label; context: { $implicit: m }" />
            }
          }
        </div>
      }
      <div class="tb__track">
        @for (s of segments(); track s.key) {
          <span
            class="tb__seg"
            [attr.data-tone]="s.tone"
            [style.inset-inline-start.%]="s.from"
            [style.width.%]="s.to - s.from"
          ></span>
        }
        @for (m of markers(); track m.key) {
          <span
            class="tb__tick"
            [style.inset-inline-start.%]="m.at"
            [attr.data-tone]="m.tone"
          ></span>
        }
      </div>
      <div class="tb__labels">
        @for (m of markers(); track m.key; let odd = $odd) {
          @if (compact() || !odd) {
            <ng-container *ngTemplateOutlet="label; context: { $implicit: m }" />
          }
        }
      </div>
    </div>

    <ng-template #label let-m>
      <span class="tb__label" [style.inset-inline-start.%]="m.at" [attr.data-tone]="m.tone">
        <strong class="ltr">{{ m.km | num }}</strong>
        @if (!compact()) {
          <small>{{ m.label }}</small>
        }
      </span>
    </ng-template>
  `,
  styles: `
    :host {
      display: block;
    }
    .tb {
      padding-bottom: 0.25rem;
    }
    .tb__track {
      position: relative;
      height: 0.75rem;
      border-radius: var(--r-full);
      background: var(--bg3);
      overflow: hidden;
    }
    .tb--compact .tb__track {
      height: 0.5rem;
    }
    .tb__seg {
      position: absolute;
      top: 0;
      bottom: 0;
      transition:
        inset-inline-start var(--dur-4) var(--ease-out),
        width var(--dur-4) var(--ease-out);
    }
    [data-tone='ok'] {
      --tone: var(--gr);
    }
    [data-tone='warn'] {
      --tone: var(--am);
    }
    [data-tone='warn2'] {
      --tone: color-mix(in srgb, var(--am) 70%, var(--re));
    }
    [data-tone='crit'] {
      --tone: color-mix(in srgb, var(--am) 40%, var(--re));
    }
    [data-tone='over'] {
      --tone: var(--re);
    }
    .tb__seg {
      background: var(--tone);
      opacity: 0.85;
    }
    .tb__seg[data-tone='over'] {
      background: repeating-linear-gradient(
        -45deg,
        var(--re) 0 0.375rem,
        color-mix(in srgb, var(--re) 70%, transparent) 0.375rem 0.75rem
      );
    }
    .tb__tick {
      position: absolute;
      top: -1px;
      bottom: -1px;
      width: 2px;
      margin-inline-start: -1px;
      background: var(--bg2);
      transition: inset-inline-start var(--dur-4) var(--ease-out);
    }
    .tb__labels {
      position: relative;
      height: 2.25rem;
      margin-top: 0.375rem;
    }
    .tb__labels--top {
      margin: 0 0 0.375rem;
      .tb__label {
        top: auto;
        bottom: 0;
      }
    }
    .tb--compact .tb__labels {
      height: 1.125rem;
    }
    .tb__label {
      position: absolute;
      top: 0;
      display: grid;
      justify-items: center;
      transform: translateX(50%);
      white-space: nowrap;
      line-height: 1.15;
      transition: inset-inline-start var(--dur-4) var(--ease-out);

      strong {
        font-size: var(--fs-xs);
        color: var(--tone);
      }
      small {
        font-size: 0.625rem;
        color: var(--txt3);
      }
    }
    :host-context([dir='ltr']) .tb__label {
      transform: translateX(-50%);
    }
    .tb--invalid .tb__track {
      box-shadow: 0 0 0 2px var(--re-l);
      animation: shake var(--dur-4) var(--ease-out);
    }
  `,
})
export class ThresholdBarComponent {
  readonly firstWarningKm = input<number | null | undefined>(null);
  readonly secondWarningKm = input<number | null | undefined>(null);
  readonly criticalKm = input<number | null | undefined>(null);
  readonly maxKm = input<number | null | undefined>(null);
  readonly compact = input(false);

  private readonly values = computed(() => [
    num(this.firstWarningKm()),
    num(this.secondWarningKm()),
    num(this.criticalKm()),
    num(this.maxKm()),
  ]);

  protected readonly valid = computed(() => {
    const [a, b, c, d] = this.values();
    return a > 0 && a < b && b < c && c < d;
  });

  /** Scale end: 20% headroom past the largest threshold. */
  private readonly scale = computed(() => Math.max(...this.values(), 1) * 1.2);
  private readonly pct = (km: number) => Math.min(100, Math.max(0, (km / this.scale()) * 100));

  protected readonly segments = computed<Segment[]>(() => {
    const [a, b, c, d] = this.values();
    const p = this.pct;
    return [
      { key: 'ok', from: 0, to: p(a), tone: 'ok' },
      { key: 'w1', from: p(a), to: p(Math.max(a, b)), tone: 'warn' },
      { key: 'w2', from: p(b), to: p(Math.max(b, c)), tone: 'warn2' },
      { key: 'cr', from: p(c), to: p(Math.max(c, d)), tone: 'crit' },
      { key: 'ov', from: p(d), to: 100, tone: 'over' },
    ];
  });

  protected readonly markers = computed<Marker[]>(() => {
    const [a, b, c, d] = this.values();
    return [
      { key: 'first', km: a, label: OIL_LEVEL.FirstWarning.label, tone: 'warn' },
      { key: 'second', km: b, label: OIL_LEVEL.SecondWarning.label, tone: 'warn2' },
      { key: 'critical', km: c, label: OIL_LEVEL.Critical.label, tone: 'crit' },
      { key: 'max', km: d, label: 'الحد الأقصى', tone: 'over' },
    ].map((m) => ({ ...m, at: this.pct(m.km) }));
  });

  protected readonly ariaLabel = computed(() => {
    const [a, b, c, d] = this.values();
    return `تنبيه أول ${a} كم، تنبيه ثانٍ ${b} كم، حرج ${c} كم، الحد الأقصى ${d} كم`;
  });
}
