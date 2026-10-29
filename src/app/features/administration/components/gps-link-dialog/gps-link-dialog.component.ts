import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { MOTORCYCLE_STATUS } from '@core/constants/enums';
import { LookupService } from '@core/data/lookup.service';
import { createResource } from '@core/data/resource';
import { ApiError } from '@core/models/api-response.model';
import { MotorcycleDto } from '@core/models/domain.models';
import { ToastService } from '@core/services/toast.service';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { ChipComponent, EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { GpsDevicesApi } from '../../data-access/gps-devices.api';
import { GpsDeviceDto, deviceName } from '../../models/gps-device.models';

/** `POST /gps/devices/{id}/link { motorcycleId, notes }` with a live motorcycle search. */
@Component({
  selector: 'app-gps-link-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, SearchInputComponent, ChipComponent, EnumChipComponent, IconComponent],
  template: `
    <app-modal [open]="!!device()" title="ربط الجهاز بموتوسيكل" size="md" (closed)="closed.emit()">
      @if (device(); as d) {
        <p class="gl-lead">
          الجهاز <strong class="ltr">{{ name(d) || d.imei }}</strong> — اختر الموتوسيكل الذي رُكّب
          عليه. بعد الربط يظهر موقعه على الخريطة وتُحتسب مسافاته من هذا الجهاز.
        </p>
        <app-search-input
          [value]="search()"
          (valueChange)="search.set($event)"
          placeholder="ابحث برقم اللوحة أو الكود…"
        />

        <div
          class="gl-list"
          role="listbox"
          aria-label="الموتوسيكلات"
          [attr.aria-busy]="results.loading()"
        >
          @if (results.loading() && !options().length) {
            @for (i of [1, 2, 3]; track i) {
              <span class="skeleton gl-skel"></span>
            }
          } @else {
            @for (m of options(); track m.id) {
              <button
                type="button"
                role="option"
                class="gl-item"
                [class.gl-item--on]="selected()?.id === m.id"
                [attr.aria-selected]="selected()?.id === m.id"
                (click)="selected.set(m)"
              >
                <span class="gl-item__check">
                  <app-icon
                    [name]="selected()?.id === m.id ? 'check-circle' : 'bike'"
                    [size]="18"
                  />
                </span>
                <span class="gl-item__text">
                  <strong class="ltr">{{ m.plateNumber }}</strong>
                  <small class="muted">
                    {{ m.brand }} {{ m.model }}
                    @if (m.officeName) {
                      · {{ m.officeName }}
                    }
                  </small>
                </span>
                <span class="gl-item__chips">
                  <app-enum-chip [map]="STATUS" [value]="m.status" [small]="true" />
                  @if (m.hasGpsDevice) {
                    <app-chip tone="warning" icon="map-pin" [small]="true">مزود بجهاز</app-chip>
                  }
                </span>
              </button>
            } @empty {
              <p class="muted gl-empty">
                {{ search() ? 'لا توجد موتوسيكلات مطابقة' : 'اكتب للبحث عن موتوسيكل' }}
              </p>
            }
          }
        </div>

        @if (selected()?.hasGpsDevice) {
          <p class="gl-warn">
            <app-icon name="alert" [size]="16" />
            هذا الموتوسيكل مرتبط بجهاز آخر بالفعل؛ افصل الجهاز القديم أولًا إن رفض النظام الربط.
          </p>
        }

        <label class="form-label gl-notes-label" for="gl-notes">ملاحظات</label>
        <input
          id="gl-notes"
          class="form-control"
          [value]="notes()"
          (input)="notes.set($any($event.target).value)"
          placeholder="مثال: رُكّب تحت المقعد"
        />
      }
      <div class="modal-actions">
        <button type="button" class="btn" (click)="closed.emit()">إلغاء</button>
        <button
          type="button"
          class="btn btn-brand"
          [disabled]="!selected() || saving()"
          (click)="link()"
        >
          @if (saving()) {
            <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
          }
          ربط الجهاز
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .gl-lead {
      margin: 0 0 0.75rem;
      font-size: var(--fs-sm);
      color: var(--txt2);
      line-height: 1.7;
    }
    .gl-list {
      display: grid;
      gap: 0.375rem;
      max-height: 18rem;
      margin: 0.75rem 0;
      overflow-y: auto;
    }
    .gl-skel {
      height: 3.25rem;
      border-radius: var(--r);
    }
    .gl-item {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--brd);
      border-radius: var(--r);
      background: var(--bg2);
      color: var(--txt);
      font: inherit;
      text-align: start;
      cursor: pointer;
      transition:
        border-color var(--dur-2),
        background var(--dur-2);
      &:hover {
        border-color: var(--primary);
      }
      &:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--primary-ring);
      }
      &--on {
        border-color: var(--primary);
        background: var(--primary-soft);
        .gl-item__check {
          color: var(--primary);
        }
      }
    }
    .gl-item__check {
      color: var(--txt3);
    }
    .gl-item__text {
      display: grid;
      flex: 1;
      min-width: 0;
      font-size: var(--fs-sm);
      strong {
        justify-self: start;
      }
      small {
        font-size: var(--fs-xs);
      }
    }
    .gl-item__chips {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.25rem;
    }
    .gl-empty {
      margin: 0;
      padding: 1rem;
      text-align: center;
      font-size: var(--fs-sm);
    }
    .gl-warn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0 0 0.75rem;
      padding: 0.5rem 0.75rem;
      border-radius: var(--r);
      background: var(--am-l);
      color: var(--am);
      font-size: var(--fs-xs);
    }
    .gl-notes-label {
      margin-top: 0.25rem;
    }
  `,
})
export class GpsLinkDialogComponent {
  private readonly api = inject(GpsDevicesApi);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);

  readonly device = input<GpsDeviceDto | null>(null);
  readonly closed = output<void>();
  readonly linked = output<void>();

  protected readonly STATUS = MOTORCYCLE_STATUS;
  protected readonly name = deviceName;
  protected readonly search = signal('');
  protected readonly notes = signal('');
  protected readonly selected = signal<MotorcycleDto | null>(null);
  protected readonly saving = signal(false);

  protected readonly results = createResource(
    () => (this.device() ? this.search() : null),
    (s) => this.lookups.motorcycles(s),
  );
  /** Bikes without a tracker first — they're the usual target. */
  protected readonly options = computed(() =>
    [...(this.results.value() ?? [])].sort(
      (a, b) => Number(!!a.hasGpsDevice) - Number(!!b.hasGpsDevice),
    ),
  );

  constructor() {
    effect(() => {
      const d = this.device();
      untracked(() => {
        if (!d) return;
        this.search.set('');
        this.notes.set('');
        this.selected.set(null);
        this.saving.set(false);
      });
    });
  }

  protected link(): void {
    const d = this.device();
    const m = this.selected();
    if (!d || !m) return;
    this.saving.set(true);
    this.api.link(d.id, { motorcycleId: m.id, notes: this.notes().trim() || null }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(`تم ربط الجهاز بالموتوسيكل ${m.plateNumber}`);
        this.linked.emit();
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        this.toast.error(err.message);
      },
    });
  }
}
