import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ChipComponent } from '@shared/components/chip/chip.component';
import { CairoDatePipe, NumberPipe } from '@shared/pipes/format.pipes';

type Kind = 'number' | 'boolean' | 'date' | 'text' | 'list' | 'object' | 'empty';

interface Entry {
  key: string;
  label: string;
  kind: Kind;
  value: unknown;
  /** Nested entries for objects (one level deep). */
  children?: Entry[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** "lastSyncAtUtc" → "last sync at" — readable fallback for keys we have no label for. */
const humanize = (key: string): string =>
  key
    .replace(/Utc$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase();

function kindOf(key: string, v: unknown): Kind {
  if (v === null || v === undefined || v === '') return 'empty';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'string') return ISO_DATE.test(v) || /Utc$/.test(key) ? 'date' : 'text';
  if (Array.isArray(v)) return 'list';
  return 'object';
}

/**
 * Renders an object whose shape we don't know (stats, health payloads):
 * numbers as tiles, booleans as yes/no chips, ISO dates in Cairo time,
 * nested objects as sub-groups. Known keys get Arabic labels via `labels`.
 */
@Component({
  selector: 'app-kv-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChipComponent, CairoDatePipe, NumberPipe],
  template: `
    @if (numbers().length) {
      <div class="kvv__tiles">
        @for (e of numbers(); track e.key; let i = $index) {
          <div class="kvv__tile anim-scale-in" [style.--i]="i">
            <span class="kvv__num">{{ $any(e.value) | num: true }}</span>
            <span class="kvv__label">{{ e.label }}</span>
          </div>
        }
      </div>
    }
    @if (others().length) {
      <dl class="kv kvv__list">
        @for (e of others(); track e.key) {
          <div [class.span-all]="e.kind === 'object' || e.kind === 'list'">
            <dt>{{ e.label }}</dt>
            <dd>
              @switch (e.kind) {
                @case ('boolean') {
                  @if (e.value) {
                    <app-chip tone="success" icon="check-circle" [small]="true">نعم</app-chip>
                  } @else {
                    <app-chip tone="neutral" icon="minus-circle" [small]="true">لا</app-chip>
                  }
                }
                @case ('date') {
                  {{ $any(e.value) | cairoDate }}
                  <span class="muted kvv__rel">({{ $any(e.value) | cairoDate: 'relative' }})</span>
                }
                @case ('list') {
                  @if (asList(e.value).length) {
                    <div class="kvv__chips">
                      @for (item of asList(e.value); track $index) {
                        <app-chip [small]="true">{{ item }}</app-chip>
                      }
                    </div>
                  } @else {
                    <span class="muted">—</span>
                  }
                }
                @case ('object') {
                  <app-kv-view class="kvv__nested" [data]="e.value" [labels]="labels()" />
                }
                @case ('empty') {
                  <span class="muted">—</span>
                }
                @default {
                  <span class="kvv__text">{{ e.value }}</span>
                }
              }
            </dd>
          </div>
        }
      </dl>
    }
    @if (!numbers().length && !others().length) {
      <p class="muted m-0">لا توجد بيانات لعرضها.</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .kvv__tiles {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
      gap: 0.625rem;
      margin-bottom: 1rem;
    }
    .kvv__tile {
      display: grid;
      gap: 0.125rem;
      padding: 0.875rem 1rem;
      border: 1px solid var(--brd);
      border-radius: var(--rl);
      background: var(--bg3);
      animation-delay: calc(var(--i, 0) * 40ms);
      transition:
        transform var(--dur-3) var(--ease-out),
        border-color var(--dur-2);
      &:hover {
        transform: translateY(-2px);
        border-color: var(--primary);
      }
    }
    .kvv__num {
      font-size: var(--fs-xl);
      font-weight: 700;
      line-height: 1.2;
      color: var(--primary);
      font-variant-numeric: tabular-nums;
    }
    .kvv__label {
      font-size: var(--fs-xs);
      color: var(--txt2);
    }
    .kvv__list .span-all {
      grid-column: 1 / -1;
    }
    .kvv__rel {
      font-size: var(--fs-xs);
      font-weight: 400;
    }
    .kvv__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }
    .kvv__nested {
      margin-top: 0.375rem;
      padding: 0.75rem;
      border: 1px dashed var(--brd2);
      border-radius: var(--r);
    }
    .kvv__text {
      unicode-bidi: plaintext;
    }
  `,
})
export class KvViewComponent {
  readonly data = input<unknown>(null);
  /** Arabic labels by key; unknown keys fall back to a humanized key. */
  readonly labels = input<Record<string, string>>({});
  /** Keys to leave out (e.g. ids already shown elsewhere). */
  readonly hide = input<readonly string[]>([]);

  private readonly entries = computed<Entry[]>(() => {
    const d = this.data();
    if (!d || typeof d !== 'object' || Array.isArray(d)) return [];
    const labels = this.labels();
    const hidden = new Set(this.hide());
    return Object.entries(d as Record<string, unknown>)
      .filter(([k]) => !hidden.has(k))
      .map(([key, value]) => ({
        key,
        value,
        label: labels[key] ?? humanize(key),
        kind: kindOf(key, value),
      }));
  });

  protected readonly numbers = computed(() => this.entries().filter((e) => e.kind === 'number'));
  protected readonly others = computed(() => this.entries().filter((e) => e.kind !== 'number'));

  protected asList(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    return v.map((x) =>
      x && typeof x === 'object'
        ? String(
            (x as Record<string, unknown>)['name'] ??
              (x as Record<string, unknown>)['title'] ??
              JSON.stringify(x),
          )
        : String(x),
    );
  }
}
