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
import { DRIVER_STATUS, enumOptions } from '@core/constants/enums';
import { DriverDto } from '@core/models/domain.models';
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
import { DriversApi } from '../../data-access/drivers.api';
import {
  DRIVERS_QUERY_DEFAULTS,
  DriverWithCredentials,
  DriversQuery,
} from '../../models/driver.models';
import { DriverFormDialogComponent } from '../../components/driver-form-dialog/driver-form-dialog.component';
import { CredentialsDialogComponent } from '../../components/credentials-dialog/credentials-dialog.component';
import { LicenseExpiryComponent } from '../../components/license-expiry/license-expiry.component';

type Row = TemplateRef<{ $implicit: DriverDto }>;

/** 5.5 — Drivers list. Every filter, the page and the sort live in the URL. */
@Component({
  selector: 'app-drivers-list',
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
    DriverFormDialogComponent,
    CredentialsDialogComponent,
    LicenseExpiryComponent,
  ],
  templateUrl: './drivers-list.component.html',
})
export class DriversListComponent {
  private readonly api = inject(DriversApi);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly lookups = inject(LookupService);

  protected readonly P = PERMISSIONS;
  protected readonly STATUS = DRIVER_STATUS;
  protected readonly statusOptions = enumOptions(DRIVER_STATUS);

  protected readonly filters = injectUrlState<DriversQuery>(DRIVERS_QUERY_DEFAULTS);
  protected readonly f = this.filters.state;

  protected readonly canPickOffice = computed(() => !!this.auth.currentUser()?.hasGlobalScope);
  protected readonly offices = toSignal(this.lookups.offices(), { initialValue: [] });
  protected readonly staff = toSignal(this.lookups.staff(), { initialValue: [] });

  protected readonly drivers = createResource(
    () => this.f(),
    (q) => this.api.list(q),
    { refetchOn: inject(DashboardHubService).reconnected$ },
  );
  protected readonly rows = computed(() => this.drivers.value()?.data ?? []);
  protected readonly page = computed(() => this.drivers.value());

  protected readonly hasFilters = computed(() => {
    const f = this.f();
    return !!(
      f.search ||
      f.status ||
      f.officeId ||
      f.supervisorUserId ||
      f.hasActiveAssignment ||
      f.hasAppAccess
    );
  });

  protected readonly formOpen = signal(false);
  /** Set after a create → the credentials dialog; cleared once acknowledged. */
  protected readonly created = signal<DriverWithCredentials | null>(null);

  private readonly nameTpl = viewChild<Row>('nameTpl');
  private readonly phoneTpl = viewChild<Row>('phoneTpl');
  private readonly statusTpl = viewChild<Row>('statusTpl');
  private readonly appTpl = viewChild<Row>('appTpl');
  private readonly rentalTpl = viewChild<Row>('rentalTpl');
  private readonly licenseTpl = viewChild<Row>('licenseTpl');

  protected readonly columns = computed<TableColumn<DriverDto>[]>(() => [
    { key: 'fullName', label: 'السائق', sortKey: 'name', cellTemplate: this.nameTpl() },
    { key: 'phoneNumber', label: 'الهاتف', cellTemplate: this.phoneTpl() },
    { key: 'status', label: 'الحالة', sortKey: 'status', cellTemplate: this.statusTpl() },
    { key: 'officeName', label: 'المكتب' },
    { key: 'hasAppAccess', label: 'التطبيق', cellTemplate: this.appTpl() },
    { key: 'hasActiveAssignment', label: 'الإيجار', cellTemplate: this.rentalTpl() },
    {
      key: 'licenseExpiryDate',
      label: 'انتهاء الرخصة',
      sortKey: 'licenseExpiry',
      cellTemplate: this.licenseTpl(),
    },
  ]);

  protected select(field: keyof DriversQuery, event: Event): void {
    this.filters.patch({
      [field]: (event.target as HTMLSelectElement).value,
    } as Partial<DriversQuery>);
  }

  protected sort(s: SortState): void {
    this.filters.patch({ sortBy: s.sortBy as DriversQuery['sortBy'], sortDesc: s.sortDesc });
  }

  protected open(d: DriverDto): void {
    void this.router.navigateByUrl(APP_ROUTES.driver(d.id));
  }

  protected onCreated(res: DriverWithCredentials): void {
    this.formOpen.set(false);
    this.created.set(res);
    this.drivers.reload();
  }

  /** After the password was acknowledged, land on the new driver's page. */
  protected onCredentialsClosed(): void {
    const id = this.created()?.driver?.id ?? this.created()?.credentials.driverId;
    this.created.set(null);
    if (id) void this.router.navigateByUrl(APP_ROUTES.driver(id));
  }
}
