import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/services/auth.service';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { LookupService } from '@core/data/lookup.service';
import { createResource } from '@core/data/resource';
import { injectUrlState } from '@core/routing/url-state';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { APP_ROUTES } from '@core/constants/app-routes';
import { MOTORCYCLE_HEALTH, MOTORCYCLE_STATUS, enumOptions } from '@core/constants/enums';
import { MotorcycleDto } from '@core/models/domain.models';
import {
  DataTableComponent,
  SortState,
  TableColumn,
} from '@shared/components/data-table/data-table.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { ChipComponent, EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { CairoDatePipe } from '@shared/pipes/format.pipes';
import { MotorcyclesApi } from '../../data-access/motorcycles.api';
import { MOTORCYCLES_QUERY_DEFAULTS, MotorcyclesQuery } from '../../models/motorcycle.models';
import { MotorcycleFormDialogComponent } from '../../components/motorcycle-form-dialog/motorcycle-form-dialog.component';

type Row = TemplateRef<{ $implicit: MotorcycleDto }>;

/** 5.3 — Motorcycles list. Every filter, the page and the sort live in the URL. */
@Component({
  selector: 'app-motorcycles-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTableComponent,
    PaginationComponent,
    PageHeaderComponent,
    SearchInputComponent,
    ChipComponent,
    EnumChipComponent,
    IconComponent,
    HasPermissionDirective,
    CairoDatePipe,
    MotorcycleFormDialogComponent,
  ],
  templateUrl: './motorcycles-list.component.html',
})
export class MotorcyclesListComponent {
  private readonly api = inject(MotorcyclesApi);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly P = PERMISSIONS;
  protected readonly STATUS = MOTORCYCLE_STATUS;
  protected readonly HEALTH = MOTORCYCLE_HEALTH;
  protected readonly statusOptions = enumOptions(MOTORCYCLE_STATUS);

  protected readonly filters = injectUrlState<MotorcyclesQuery>(MOTORCYCLES_QUERY_DEFAULTS);
  protected readonly f = this.filters.state;

  /** The office filter only makes sense for users who can see every office. */
  protected readonly canPickOffice = computed(() => !!this.auth.currentUser()?.hasGlobalScope);
  protected readonly offices = toSignal(inject(LookupService).offices(), { initialValue: [] });

  protected readonly motorcycles = createResource(
    () => this.f(),
    (q) => this.api.list(q),
    { refetchOn: inject(DashboardHubService).reconnected$ },
  );
  protected readonly rows = computed(() => this.motorcycles.value()?.data ?? []);
  protected readonly page = computed(() => this.motorcycles.value());

  protected readonly hasFilters = computed(() => {
    const f = this.f();
    return !!(f.search || f.status || f.officeId || f.hasGpsDevice);
  });

  protected readonly formOpen = signal(false);

  private readonly plateTpl = viewChild<Row>('plateTpl');
  private readonly statusTpl = viewChild<Row>('statusTpl');
  private readonly healthTpl = viewChild<Row>('healthTpl');
  private readonly gpsTpl = viewChild<Row>('gpsTpl');
  private readonly createdTpl = viewChild<Row>('createdTpl');

  protected readonly columns = computed<TableColumn<MotorcycleDto>[]>(() => [
    { key: 'plateNumber', label: 'رقم اللوحة', sortKey: 'plate', cellTemplate: this.plateTpl() },
    { key: 'brand', label: 'الماركة / الموديل', sortKey: 'brand' },
    { key: 'status', label: 'الحالة', sortKey: 'status', cellTemplate: this.statusTpl() },
    { key: 'health', label: 'الصحة', cellTemplate: this.healthTpl() },
    { key: 'officeName', label: 'المكتب' },
    { key: 'hasGpsDevice', label: 'جهاز التتبع', align: 'center', cellTemplate: this.gpsTpl() },
    {
      key: 'createdAtUtc',
      label: 'تاريخ الإضافة',
      sortKey: 'createdAt',
      cellTemplate: this.createdTpl(),
    },
  ]);

  protected select(field: keyof MotorcyclesQuery, event: Event): void {
    this.filters.patch({
      [field]: (event.target as HTMLSelectElement).value,
    } as Partial<MotorcyclesQuery>);
  }

  protected sort(s: SortState): void {
    this.filters.patch({ sortBy: s.sortBy as MotorcyclesQuery['sortBy'], sortDesc: s.sortDesc });
  }

  protected open(m: MotorcycleDto): void {
    void this.router.navigateByUrl(APP_ROUTES.motorcycle(m.id) as string);
  }

  protected onSaved(m: MotorcycleDto): void {
    this.formOpen.set(false);
    void this.router.navigateByUrl(APP_ROUTES.motorcycle(m.id) as string);
  }
}
