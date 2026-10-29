import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { createResource } from '@core/data/resource';
import { OfficeDto } from '@core/models/domain.models';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { ChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { OfficesApi } from '../../data-access/offices.api';
import { OFFICE_STATS_LABELS } from '../../models/office.models';
import { KvViewComponent } from '../kv-view/kv-view.component';

/** Office card + live counters from `GET /offices/{id}/stats` (rendered generically). */
@Component({
  selector: 'app-office-details-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, ChipComponent, IconComponent, KvViewComponent],
  template: `
    <app-modal
      [open]="!!office()"
      [title]="office()?.name ?? ''"
      size="lg"
      (closed)="closed.emit()"
    >
      @if (office(); as o) {
        <div class="od-chips">
          @if (o.isActive) {
            <app-chip tone="success" icon="check-circle">نشط</app-chip>
          } @else {
            <app-chip tone="neutral" icon="pause">موقوف</app-chip>
          }
          @if (o.code) {
            <app-chip icon="building"
              ><span class="ltr">{{ o.code }}</span></app-chip
            >
          }
        </div>

        <dl class="kv od-kv">
          <div>
            <dt>المدينة</dt>
            <dd>{{ o.city || '—' }}</dd>
          </div>
          <div>
            <dt>مدير المكتب</dt>
            <dd>{{ o.managerName || '—' }}</dd>
          </div>
          <div>
            <dt>الهاتف</dt>
            <dd class="ltr od-start">{{ o.phone || '—' }}</dd>
          </div>
          <div>
            <dt>البريد الإلكتروني</dt>
            <dd class="ltr od-start">{{ o.email || '—' }}</dd>
          </div>
          @if (o.address) {
            <div class="od-wide">
              <dt>العنوان</dt>
              <dd>{{ o.address }}</dd>
            </div>
          }
          @if (o.notes) {
            <div class="od-wide">
              <dt>ملاحظات</dt>
              <dd class="od-notes">{{ o.notes }}</dd>
            </div>
          }
        </dl>

        <h3 class="od-title">
          <app-icon name="chart" [size]="16" />
          إحصائيات المكتب
          <button
            type="button"
            class="btn btn-ghost btn-sm od-refresh"
            [disabled]="stats.loading()"
            (click)="stats.reload()"
            aria-label="تحديث الإحصائيات"
          >
            <app-icon name="refresh" [size]="14" />
          </button>
        </h3>
        @if (stats.initialLoading()) {
          <div class="od-skeletons" aria-busy="true">
            @for (i of [1, 2, 3, 4]; track i) {
              <span class="skeleton od-skeleton"></span>
            }
          </div>
        } @else if (stats.error()) {
          <div
            class="alert alert-danger d-flex justify-content-between align-items-center"
            role="alert"
          >
            <span>{{ stats.error()?.message }}</span>
            <button type="button" class="btn btn-sm" (click)="stats.reload()">
              إعادة المحاولة
            </button>
          </div>
        } @else {
          <app-kv-view [data]="stats.value()" [labels]="labels" [hide]="hidden" />
        }
      }
      <div class="modal-actions">
        @if (canManage()) {
          <button type="button" class="btn" (click)="edit.emit()">
            <app-icon name="edit" [size]="16" />
            تعديل
          </button>
        }
        <button type="button" class="btn btn-brand" (click)="closed.emit()">إغلاق</button>
      </div>
    </app-modal>
  `,
  styles: `
    .od-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
      margin-bottom: 1rem;
    }
    .od-kv {
      margin-bottom: 1.25rem;
    }
    .od-wide {
      grid-column: 1 / -1;
    }
    .od-start {
      text-align: end;
    }
    .od-notes {
      white-space: pre-line;
      font-weight: 400;
    }
    .od-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0 0 0.75rem;
      padding-top: 0.875rem;
      border-top: 1px dashed var(--brd2);
      font-size: var(--fs-sm);
      font-weight: 700;
      color: var(--txt2);
      app-icon {
        color: var(--primary);
      }
    }
    .od-refresh {
      margin-inline-start: auto;
    }
    .od-skeletons {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
      gap: 0.625rem;
    }
    .od-skeleton {
      height: 4.25rem;
      border-radius: var(--rl);
    }
  `,
})
export class OfficeDetailsDialogComponent {
  private readonly api = inject(OfficesApi);

  readonly office = input<OfficeDto | null>(null);
  readonly canManage = input(false);
  readonly closed = output<void>();
  readonly edit = output<void>();

  protected readonly labels = OFFICE_STATS_LABELS;
  protected readonly hidden = ['officeId', 'officeName', 'id', 'name'];

  protected readonly stats = createResource(
    () => this.office()?.id ?? null,
    (id) => this.api.stats(id),
  );
}
