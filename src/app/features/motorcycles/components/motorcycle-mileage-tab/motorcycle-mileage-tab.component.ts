import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { createResource } from '@core/data/resource';
import { injectUrlState } from '@core/routing/url-state';
import { cairoToday, formatCairo } from '@core/utils/cairo-time.util';
import { formatKm } from '@core/utils/format.util';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { KmPipe } from '@shared/pipes/format.pipes';
import { MotorcyclesApi } from '../../data-access/motorcycles.api';
import { DailyMileage } from '../../models/motorcycle-overview.models';

const DEFAULT_DAYS = 30;
const MAX_DAYS = 366;
const HEIGHT = 240;
const PAD = { top: 16, right: 12, bottom: 28, left: 44 };

interface Bar {
  date: string;
  km: number;
  x: number;
  w: number;
  y: number;
  h: number;
  path: string;
  label: string | null;
}

/**
 * Motorcycle page → mileage tab (`GET /mileage/motorcycles/{id}/daily`).
 * Daily km as an inline-SVG bar chart (no chart library), drawn at the
 * container's real pixel width so text never scales. Range in `?mFrom=&mTo=`.
 */
@Component({
  selector: 'app-motorcycle-mileage-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent, IconComponent, KmPipe],
  templateUrl: './motorcycle-mileage-tab.component.html',
  styleUrl: './motorcycle-mileage-tab.component.scss',
})
export class MotorcycleMileageTabComponent {
  private readonly api = inject(MotorcyclesApi);

  readonly motorcycleId = input.required<string>();

  private readonly defaults = { mFrom: cairoToday(-(DEFAULT_DAYS - 1)), mTo: cairoToday() };
  protected readonly url = injectUrlState({ mFrom: '', mTo: '' });
  protected readonly range = computed(() => {
    const from = this.url.state().mFrom || this.defaults.mFrom;
    const to = this.url.state().mTo || this.defaults.mTo;
    const days = daysBetween(from, to) + 1;
    let error: string | null = null;
    if (!isDate(from) || !isDate(to)) error = 'حدّد تاريخ البداية والنهاية.';
    else if (days < 1) error = 'يجب أن يكون تاريخ النهاية بعد تاريخ البداية.';
    else if (days > MAX_DAYS) error = `أقصى مدة ${MAX_DAYS} يومًا.`;
    return { from, to, days, error };
  });

  protected readonly mileage = createResource(
    () => {
      const r = this.range();
      return r.error ? null : { id: this.motorcycleId(), from: r.from, to: r.to };
    },
    ({ id, from, to }) => this.api.dailyMileage(id, from, to),
  );

  /** Every day of the range, zero-filled so gaps read as "didn't move". */
  protected readonly days = computed<DailyMileage[]>(() => {
    const r = this.range();
    const data = this.mileage.value();
    if (r.error || !data) return [];
    const byDate = new Map(data.map((d) => [d.date, d.km]));
    const out: DailyMileage[] = [];
    for (let i = 0; i < r.days; i++) {
      const date = addDays(r.from, i);
      out.push({ date, km: byDate.get(date) ?? 0 });
    }
    return out;
  });

  protected readonly summary = computed(() => {
    const days = this.days();
    if (!days.length) return null;
    const total = days.reduce((s, d) => s + d.km, 0);
    const active = days.filter((d) => d.km > 0).length;
    const max = days.reduce((m, d) => (d.km > m.km ? d : m), days[0]);
    return { total, avg: total / days.length, active, max };
  });

  // ── chart geometry ──
  private readonly host = viewChild<ElementRef<HTMLElement>>('chartHost');
  protected readonly width = signal(0);
  protected readonly height = HEIGHT;
  protected readonly pad = PAD;
  protected readonly hover = signal<number | null>(null);
  protected readonly showTable = signal(false);

  protected readonly chart = computed(() => {
    const days = this.days();
    const width = this.width();
    if (!days.length || width < 100) return null;
    const plotW = width - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const maxKm = Math.max(...days.map((d) => d.km), 1);
    const step = niceStep(maxKm / 4);
    const top = Math.ceil(maxKm / step) * step;
    const slot = plotW / days.length;
    const gap = Math.min(2, slot * 0.2);
    const w = Math.max(1, slot - gap);
    const yOf = (km: number) => PAD.top + plotH - (km / top) * plotH;
    const labelEvery = Math.ceil(days.length / Math.max(1, Math.floor(plotW / 56)));

    const bars: Bar[] = days.map((d, i) => {
      const x = PAD.left + i * slot + gap / 2;
      const y = yOf(d.km);
      const h = PAD.top + plotH - y;
      return {
        date: d.date,
        km: d.km,
        x,
        w,
        y,
        h,
        path: barPath(x, y, w, h, Math.min(4, w / 2)),
        label: i % labelEvery === 0 ? shortDate(d.date) : null,
      };
    });
    const ticks: { y: number; label: string }[] = [];
    for (let v = 0; v <= top + 1e-9; v += step)
      ticks.push({ y: yOf(v), label: String(Math.round(v)) });
    const avg = this.summary()?.avg ?? 0;
    return { bars, ticks, slot, baseline: PAD.top + plotH, avgY: avg > 0 ? yOf(avg) : null };
  });

  protected readonly hovered = computed(() => {
    const i = this.hover();
    const c = this.chart();
    return i == null || !c ? null : (c.bars[i] ?? null);
  });

  constructor() {
    afterNextRender(() => {
      const observer = new ResizeObserver((entries) =>
        this.width.set(Math.floor(entries[0]?.contentRect.width ?? 0)),
      );
      const el = this.host()?.nativeElement;
      if (el) observer.observe(el);
      this.observer = observer;
    });
    inject(DestroyRef).onDestroy(() => this.observer?.disconnect());
  }
  private observer: ResizeObserver | null = null;

  protected setDate(key: 'mFrom' | 'mTo', event: Event): void {
    const r = this.range();
    this.url.patch({ mFrom: r.from, mTo: r.to, [key]: (event.target as HTMLInputElement).value });
  }

  protected preset(days: number): void {
    this.url.patch({ mFrom: cairoToday(-(days - 1)), mTo: cairoToday() });
  }

  protected longDate(date: string): string {
    return formatCairo(date, 'date');
  }

  protected kmText(km: number): string {
    return formatKm(km, true);
  }
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function toUtcMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function daysBetween(a: string, b: string): number {
  if (!isDate(a) || !isDate(b)) return 0;
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000);
}

function addDays(date: string, n: number): string {
  return new Date(toUtcMs(date) + n * 86_400_000).toISOString().slice(0, 10);
}

/** "12/3" — day/month, compact for the axis. */
function shortDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${d}/${m}`;
}

function niceStep(raw: number): number {
  const exp = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
  const f = raw / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}

/** Bar with rounded top corners, square at the baseline. */
function barPath(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return '';
  const rr = Math.min(r, h);
  return (
    `M${x},${y + h}` +
    `V${y + rr}` +
    `Q${x},${y} ${x + rr},${y}` +
    `H${x + w - rr}` +
    `Q${x + w},${y} ${x + w},${y + rr}` +
    `V${y + h}Z`
  );
}
