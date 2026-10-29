import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_ROUTES } from '@core/constants/app-routes';
import { RENTAL_STATUS, RENT_PERIOD, enumLabel } from '@core/constants/enums';
import { createResource } from '@core/data/resource';
import { RentalDto } from '@core/models/domain.models';
import { injectUrlState } from '@core/routing/url-state';
import {
  DataTableComponent,
  TableColumn,
} from '@shared/components/data-table/data-table.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { EnumChipComponent } from '@shared/components/chip/chip.component';
import { CairoDatePipe, MoneyPipe } from '@shared/pipes/format.pipes';
import { MotorcyclesApi } from '../../data-access/motorcycles.api';

type Row = TemplateRef<{ $implicit: RentalDto }>;

/** Motorcycle page → rentals tab (`GET /motorcycles/{id}/rentals`). Page kept in `?rentalsPage=`. */
@Component({
  selector: 'app-motorcycle-rentals-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DataTableComponent,
    PaginationComponent,
    EnumChipComponent,
    CairoDatePipe,
    MoneyPipe,
  ],
  template: `
    @if (rentals.error(); as err) {
      <div
        class="alert alert-danger d-flex justify-content-between align-items-center"
        role="alert"
      >
        <span>{{ err.message }}</span>
        <button type="button" class="btn btn-sm" (click)="rentals.reload()">إعادة المحاولة</button>
      </div>
    }
    <app-data-table
      [columns]="columns()"
      [data]="rows()"
      [loading]="rentals.loading()"
      emptyIcon="route"
      emptyTitle="لم يُؤجَّر هذا الموتوسيكل بعد"
    />
    @if (rentals.value(); as p) {
      <app-pagination
        [pageIndex]="url.state().rentalsPage"
        [pageSize]="pageSize"
        [count]="p.count"
        [totalPages]="p.totalPages"
        [showPageSize]="false"
        [disabled]="rentals.loading()"
        (pageChange)="url.patch({ rentalsPage: $event })"
      />
    }

    <ng-template #driverTpl let-r>
      <a class="link-btn" [routerLink]="R.driver(r.driverId)">{{ r.driverName || 'عرض السائق' }}</a>
      @if (r.driverPhone) {
        <div class="muted ltr" style="font-size: var(--fs-xs)">{{ r.driverPhone }}</div>
      }
    </ng-template>
    <ng-template #statusTpl let-r>
      <app-enum-chip [map]="STATUS" [value]="r.status" [small]="true" />
    </ng-template>
    <ng-template #periodTpl let-r>
      {{ r.startAtUtc | cairoDate: 'date' }}
      <span class="muted">←</span>
      {{ r.endAtUtc ? (r.endAtUtc | cairoDate: 'date') : 'حتى الآن' }}
    </ng-template>
    <ng-template #rentTpl let-r>
      <span class="amount">{{ r.rentAmount | money }}</span>
      <span class="muted" style="font-size: var(--fs-xs)"> / {{ periodLabel(r.rentPeriod) }}</span>
    </ng-template>
    <ng-template #openTpl let-r>
      <a class="link-btn" [routerLink]="R.rental(r.id)">التفاصيل</a>
    </ng-template>
  `,
})
export class MotorcycleRentalsTabComponent {
  private readonly api = inject(MotorcyclesApi);

  readonly motorcycleId = input.required<string>();

  protected readonly R = APP_ROUTES;
  protected readonly STATUS = RENTAL_STATUS;
  protected readonly pageSize = 10;
  protected readonly url = injectUrlState({ rentalsPage: 1 });

  protected readonly rentals = createResource(
    () => ({ id: this.motorcycleId(), page: this.url.state().rentalsPage }),
    ({ id, page }) => this.api.rentals(id, page, this.pageSize),
  );
  protected readonly rows = computed(() => this.rentals.value()?.data ?? []);

  private readonly driverTpl = viewChild<Row>('driverTpl');
  private readonly statusTpl = viewChild<Row>('statusTpl');
  private readonly periodTpl = viewChild<Row>('periodTpl');
  private readonly rentTpl = viewChild<Row>('rentTpl');
  private readonly openTpl = viewChild<Row>('openTpl');

  protected readonly columns = computed<TableColumn<RentalDto>[]>(() => [
    { key: 'driverName', label: 'السائق', cellTemplate: this.driverTpl() },
    { key: 'status', label: 'الحالة', cellTemplate: this.statusTpl() },
    { key: 'startAtUtc', label: 'الفترة', cellTemplate: this.periodTpl() },
    { key: 'rentAmount', label: 'الإيجار', cellTemplate: this.rentTpl() },
    { key: 'contractNumber', label: 'رقم العقد' },
    { key: 'id', label: '', align: 'end', cellTemplate: this.openTpl() },
  ]);

  protected periodLabel(p: string): string {
    return enumLabel(RENT_PERIOD, p);
  }
}
