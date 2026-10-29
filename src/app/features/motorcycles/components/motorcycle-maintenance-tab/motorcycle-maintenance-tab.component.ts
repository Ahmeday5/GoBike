import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { APP_ROUTES } from '@core/constants/app-routes';
import { MAINTENANCE_STATUS, MAINTENANCE_TYPE } from '@core/constants/enums';
import { createResource } from '@core/data/resource';
import { MaintenanceRecordDto } from '@core/models/domain.models';
import { injectUrlState } from '@core/routing/url-state';
import {
  DataTableComponent,
  TableColumn,
} from '@shared/components/data-table/data-table.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { EnumChipComponent } from '@shared/components/chip/chip.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CairoDatePipe, KmPipe, MoneyPipe } from '@shared/pipes/format.pipes';
import { MotorcyclesApi } from '../../data-access/motorcycles.api';
import { OilStatusBarComponent } from '../oil-status-bar/oil-status-bar.component';

type Row = TemplateRef<{ $implicit: MaintenanceRecordDto }>;

/**
 * Motorcycle page → maintenance tab: the oil-change cycle
 * (`GET /maintenance/motorcycles/{id}/status`) and the bike's maintenance
 * records (`GET /maintenance/records?motorcycleId=`, page in `?maintPage=`).
 */
@Component({
  selector: 'app-motorcycle-maintenance-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTableComponent,
    PaginationComponent,
    EnumChipComponent,
    EmptyStateComponent,
    IconComponent,
    CairoDatePipe,
    KmPipe,
    MoneyPipe,
    OilStatusBarComponent,
  ],
  template: `
    <section class="panel">
      <header class="panel__head">
        <h2 class="panel__title"><app-icon name="droplet" [size]="18" />دورة تغيير الزيت</h2>
        @if (cycle.value()?.policyName; as name) {
          <span class="muted mt-small">السياسة: {{ name }}</span>
        }
      </header>
      @if (cycle.initialLoading()) {
        <span class="skeleton d-block" style="height: 5rem"></span>
      } @else if (cycle.error()) {
        <div
          class="alert alert-danger d-flex justify-content-between align-items-center"
          role="alert"
        >
          <span>{{ cycle.error()?.message }}</span>
          <button type="button" class="btn btn-sm" (click)="cycle.reload()">إعادة المحاولة</button>
        </div>
      } @else if (cycle.value()) {
        @let c = cycle.value()!;
        <app-oil-status-bar
          [cycle]="{
            kmSinceOilChange: c.kmSinceOilChange ?? c.kmSinceLastMaintenance,
            firstWarningKm: c.firstWarningKm,
            secondWarningKm: c.secondWarningKm,
            criticalKm: c.criticalKm,
            maxKm: c.maxKm,
            currentLevel: c.currentLevel,
          }"
        />
        <dl class="kv mt-3">
          <div>
            <dt>آخر تغيير زيت</dt>
            <dd>{{ c.lastOilChangeAtUtc ?? c.lastMaintenanceAtUtc | cairoDate: 'date' }}</dd>
          </div>
          <div>
            <dt>العداد عند آخر تغيير</dt>
            <dd>{{ c.lastMaintenanceOdometerKm | km }}</dd>
          </div>
          <div>
            <dt>العداد الحالي</dt>
            <dd>{{ c.currentOdometerKm | km }}</dd>
          </div>
          <div>
            <dt>{{ (c.overdueKm ?? 0) > 0 ? 'تجاوز الحد بـ' : 'المتبقي حتى الحد' }}</dt>
            <dd [class.text-danger]="(c.overdueKm ?? 0) > 0">
              {{ ((c.overdueKm ?? 0) > 0 ? c.overdueKm : c.remainingToMaxKm) | km }}
            </dd>
          </div>
          @if (c.baselineSetAtUtc) {
            <div>
              <dt>ضُبط العداد يدويًا</dt>
              <dd>{{ c.baselineSetAtUtc | cairoDate: 'date' }}</dd>
            </div>
          }
        </dl>
      } @else {
        <app-empty-state
          icon="droplet"
          title="لا توجد دورة صيانة"
          text="لم تُربط سياسة صيانة بهذا الموتوسيكل بعد."
        />
      }
    </section>

    <section class="panel">
      <header class="panel__head">
        <h2 class="panel__title"><app-icon name="wrench" [size]="18" />سجلات الصيانة</h2>
      </header>
      @if (records.error(); as err) {
        <div
          class="alert alert-danger d-flex justify-content-between align-items-center"
          role="alert"
        >
          <span>{{ err.message }}</span>
          <button type="button" class="btn btn-sm" (click)="records.reload()">
            إعادة المحاولة
          </button>
        </div>
      }
      <app-data-table
        [columns]="columns()"
        [data]="rows()"
        [loading]="records.loading()"
        [rowClickable]="true"
        (rowClick)="open($event)"
        emptyIcon="wrench"
        emptyTitle="لا توجد سجلات صيانة"
      />
      @if (records.value(); as p) {
        <app-pagination
          [pageIndex]="url.state().maintPage"
          [pageSize]="pageSize"
          [count]="p.count"
          [totalPages]="p.totalPages"
          [showPageSize]="false"
          [disabled]="records.loading()"
          (pageChange)="url.patch({ maintPage: $event })"
        />
      }
    </section>

    <ng-template #typeTpl let-r>
      <app-enum-chip [map]="TYPE" [value]="r.type" [small]="true" />
    </ng-template>
    <ng-template #statusTpl let-r>
      <app-enum-chip [map]="STATUS" [value]="r.status" [small]="true" />
    </ng-template>
    <ng-template #issueTpl let-r>
      <span class="mt-issue">{{ r.issueDescription || r.workPerformed || '—' }}</span>
      @if (r.faults?.length) {
        <div class="muted mt-small">
          {{ r.faults.length }} عطل · {{ r.parts?.length ?? 0 }} قطعة
        </div>
      }
    </ng-template>
    <ng-template #dateTpl let-r>
      {{ r.completedAtUtc ?? r.startedAtUtc ?? r.scheduledAtUtc | cairoDate: 'date' }}
    </ng-template>
    <ng-template #costTpl let-r
      ><span class="amount">{{ r.totalCost | money }}</span></ng-template
    >
  `,
  styles: `
    .mt-small {
      font-size: var(--fs-xs);
    }
    .mt-issue {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      max-width: 28rem;
    }
  `,
})
export class MotorcycleMaintenanceTabComponent {
  private readonly api = inject(MotorcyclesApi);
  private readonly router = inject(Router);

  readonly motorcycleId = input.required<string>();

  protected readonly TYPE = MAINTENANCE_TYPE;
  protected readonly STATUS = MAINTENANCE_STATUS;
  protected readonly pageSize = 10;
  protected readonly url = injectUrlState({ maintPage: 1 });

  protected readonly cycle = createResource(
    () => this.motorcycleId(),
    (id) => this.api.maintenanceStatus(id),
  );
  protected readonly records = createResource(
    () => ({ id: this.motorcycleId(), page: this.url.state().maintPage }),
    ({ id, page }) => this.api.maintenanceRecords(id, page, this.pageSize),
  );
  protected readonly rows = computed(() => this.records.value()?.data ?? []);

  private readonly typeTpl = viewChild<Row>('typeTpl');
  private readonly statusTpl = viewChild<Row>('statusTpl');
  private readonly issueTpl = viewChild<Row>('issueTpl');
  private readonly dateTpl = viewChild<Row>('dateTpl');
  private readonly costTpl = viewChild<Row>('costTpl');

  protected readonly columns = computed<TableColumn<MaintenanceRecordDto>[]>(() => [
    { key: 'type', label: 'النوع', cellTemplate: this.typeTpl() },
    { key: 'status', label: 'الحالة', cellTemplate: this.statusTpl() },
    { key: 'issueDescription', label: 'الوصف', cellTemplate: this.issueTpl() },
    { key: 'scheduledAtUtc', label: 'التاريخ', cellTemplate: this.dateTpl() },
    { key: 'technician', label: 'الفني' },
    { key: 'totalCost', label: 'التكلفة', align: 'end', cellTemplate: this.costTpl() },
  ]);

  protected open(r: MaintenanceRecordDto): void {
    void this.router.navigateByUrl(APP_ROUTES.maintenanceRecord(r.id));
  }
}
