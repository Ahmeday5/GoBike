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
import { DriversApi } from '../../data-access/drivers.api';

type Row = TemplateRef<{ $implicit: RentalDto }>;

/** Driver page → rentals tab (`GET /drivers/{id}/rentals`). Page kept in `?rentalsPage=`. */
@Component({
  selector: 'app-driver-rentals-tab',
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
      <div class="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
        <span>{{ err.message }}</span>
        <button type="button" class="btn btn-sm" (click)="rentals.reload()">إعادة المحاولة</button>
      </div>
    }
    <app-data-table
      [columns]="columns()"
      [data]="rows()"
      [loading]="rentals.loading()"
      emptyIcon="route"
      emptyTitle="لا توجد إيجارات لهذا السائق"
    />
    @if (rentals.value(); as p) {
      <app-pagination
        [pageIndex]="state().rentalsPage"
        [pageSize]="pageSize"
        [count]="p.count"
        [totalPages]="p.totalPages"
        [showPageSize]="false"
        [disabled]="rentals.loading()"
        (pageChange)="url.patch({ rentalsPage: $event })"
      />
    }

    <ng-template #plateTpl let-r>
      <a class="link-btn ltr" [routerLink]="motorcycleLink(r.motorcycleId)">
        {{ r.plateNumber || 'عرض الموتوسيكل' }}
      </a>
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
    <ng-template #depositTpl let-r>
      <span class="amount">{{ r.depositAmount | money }}</span>
    </ng-template>
  `,
})
export class DriverRentalsTabComponent {
  private readonly api = inject(DriversApi);

  readonly driverId = input.required<string>();

  protected readonly STATUS = RENTAL_STATUS;
  protected readonly pageSize = 10;
  protected readonly url = injectUrlState({ rentalsPage: 1 });
  protected readonly state = this.url.state;

  protected readonly rentals = createResource(
    () => ({ id: this.driverId(), page: this.state().rentalsPage }),
    ({ id, page }) => this.api.rentals(id, page, this.pageSize),
  );
  protected readonly rows = computed(() => this.rentals.value()?.data ?? []);

  private readonly plateTpl = viewChild<Row>('plateTpl');
  private readonly statusTpl = viewChild<Row>('statusTpl');
  private readonly periodTpl = viewChild<Row>('periodTpl');
  private readonly rentTpl = viewChild<Row>('rentTpl');
  private readonly depositTpl = viewChild<Row>('depositTpl');

  protected readonly columns = computed<TableColumn<RentalDto>[]>(() => [
    { key: 'plateNumber', label: 'الموتوسيكل', cellTemplate: this.plateTpl() },
    { key: 'status', label: 'الحالة', cellTemplate: this.statusTpl() },
    { key: 'startAtUtc', label: 'الفترة', cellTemplate: this.periodTpl() },
    { key: 'rentAmount', label: 'الإيجار', cellTemplate: this.rentTpl() },
    { key: 'depositAmount', label: 'التأمين', cellTemplate: this.depositTpl() },
    { key: 'contractNumber', label: 'رقم العقد' },
  ]);

  protected motorcycleLink(id: string) {
    return APP_ROUTES.motorcycle(id);
  }

  protected periodLabel(p: string): string {
    return enumLabel(RENT_PERIOD, p);
  }
}
