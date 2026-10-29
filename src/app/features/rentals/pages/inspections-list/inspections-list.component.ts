import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/services/auth.service';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { APP_ROUTES } from '@core/constants/app-routes';
import { INSPECTION_RESULT, enumOptions } from '@core/constants/enums';
import { LookupService } from '@core/data/lookup.service';
import { createResource } from '@core/data/resource';
import { InspectionDto } from '@core/models/domain.models';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { injectUrlState } from '@core/routing/url-state';
import {
  DataTableComponent,
  TableColumn,
} from '@shared/components/data-table/data-table.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CairoDatePipe } from '@shared/pipes/format.pipes';
import { RentalsApi } from '../../data-access/rentals.api';
import {
  INSPECTIONS_QUERY_DEFAULTS,
  InspectionsQuery,
  ScopeChip,
} from '../../models/rental.models';

type Row = TemplateRef<{ $implicit: InspectionDto }>;

/** Return inspections (`GET /inspections`). Filters and page live in the URL. */
@Component({
  selector: 'app-inspections-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DataTableComponent,
    PaginationComponent,
    PageHeaderComponent,
    EnumChipComponent,
    IconComponent,
    CairoDatePipe,
  ],
  templateUrl: './inspections-list.component.html',
  styleUrl: '../rentals-list/rentals-list.component.scss',
})
export class InspectionsListComponent {
  private readonly api = inject(RentalsApi);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly RESULT = INSPECTION_RESULT;
  protected readonly resultOptions = enumOptions(INSPECTION_RESULT);

  protected readonly filters = injectUrlState<InspectionsQuery>(INSPECTIONS_QUERY_DEFAULTS);
  protected readonly f = this.filters.state;

  protected readonly canPickOffice = computed(() => !!this.auth.currentUser()?.hasGlobalScope);
  protected readonly offices = toSignal(inject(LookupService).offices(), { initialValue: [] });

  protected readonly can = computed(() => ({
    motorcycles: this.auth.hasPermission(PERMISSIONS.Motorcycles.Read),
    drivers: this.auth.hasPermission(PERMISSIONS.Drivers.Read),
    maintenance: this.auth.hasPermission(PERMISSIONS.Maintenance.Read),
  }));

  protected readonly inspections = createResource(
    () => this.f(),
    (q) => this.api.inspections(q),
    { refetchOn: inject(DashboardHubService).reconnected$ },
  );
  protected readonly rows = computed(() => this.inspections.value()?.data ?? []);
  protected readonly page = computed(() => this.inspections.value());

  protected readonly hasFilters = computed(() => {
    const f = this.f();
    return !!(f.result || f.officeId || f.motorcycleId || f.driverId);
  });

  protected readonly scopeChips = computed<ScopeChip[]>(() => {
    const { motorcycleId, driverId } = this.f();
    const rows = this.rows();
    const chips: ScopeChip[] = [];
    if (motorcycleId) {
      const plate = rows.find((r) => r.motorcycleId === motorcycleId)?.plateNumber;
      chips.push({
        key: 'motorcycleId',
        icon: 'bike',
        label: plate ? `الموتوسيكل ${plate}` : 'موتوسيكل محدد',
      });
    }
    if (driverId) {
      const name = rows.find((r) => r.driverId === driverId)?.driverName;
      chips.push({ key: 'driverId', icon: 'user', label: name ? `السائق ${name}` : 'سائق محدد' });
    }
    return chips;
  });

  private readonly dateTpl = viewChild<Row>('dateTpl');
  private readonly plateTpl = viewChild<Row>('plateTpl');
  private readonly driverTpl = viewChild<Row>('driverTpl');
  private readonly resultTpl = viewChild<Row>('resultTpl');
  private readonly faultsTpl = viewChild<Row>('faultsTpl');
  private readonly byTpl = viewChild<Row>('byTpl');
  private readonly repairTpl = viewChild<Row>('repairTpl');

  protected readonly columns = computed<TableColumn<InspectionDto>[]>(() => [
    { key: 'inspectedAtUtc', label: 'التاريخ', cellTemplate: this.dateTpl() },
    { key: 'plateNumber', label: 'الموتوسيكل', cellTemplate: this.plateTpl() },
    { key: 'driverName', label: 'السائق', cellTemplate: this.driverTpl() },
    { key: 'result', label: 'النتيجة', cellTemplate: this.resultTpl() },
    { key: 'faults', label: 'الأعطال', cellTemplate: this.faultsTpl() },
    { key: 'inspectedByName', label: 'الفاحص', cellTemplate: this.byTpl() },
    { key: 'maintenanceRecordId', label: 'الإصلاح', cellTemplate: this.repairTpl() },
  ]);

  protected select(field: keyof InspectionsQuery, event: Event): void {
    this.filters.patch({
      [field]: (event.target as HTMLSelectElement).value,
    } as Partial<InspectionsQuery>);
  }

  protected clearScope(key: ScopeChip['key']): void {
    this.filters.patch({ [key]: '' });
  }

  protected motorcycleLink(id: string) {
    return APP_ROUTES.motorcycle(id);
  }

  protected driverLink(id: string): string {
    return APP_ROUTES.driver(id);
  }

  protected repairLink(id: string): string {
    return APP_ROUTES.maintenanceRecord(id);
  }

  protected open(i: InspectionDto): void {
    void this.router.navigateByUrl(APP_ROUTES.inspection(i.id));
  }
}
