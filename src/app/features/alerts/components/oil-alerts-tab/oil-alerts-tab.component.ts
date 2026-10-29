import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { filter, merge } from 'rxjs';
import { AuthService } from '@core/auth/services/auth.service';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { APP_ROUTES } from '@core/constants/app-routes';
import {
  MAINTENANCE_ALERT_LEVEL,
  MAINTENANCE_ALERT_STATUS,
  enumOptions,
} from '@core/constants/enums';
import { LookupService } from '@core/data/lookup.service';
import { createResource } from '@core/data/resource';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { injectUrlState } from '@core/routing/url-state';
import { ToastService } from '@core/services/toast.service';
import {
  DataTableComponent,
  TableColumn,
} from '@shared/components/data-table/data-table.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { CairoDatePipe, KmPipe } from '@shared/pipes/format.pipes';
import { AlertsApi } from '../../data-access/alerts.api';
import {
  MaintenanceAlertDto,
  OIL_ALERTS_QUERY_DEFAULTS,
  OIL_LEVEL_KM,
  OilAlertsQuery,
  isOilNotification,
} from '../../models/alerts.models';

type Row = TemplateRef<{ $implicit: MaintenanceAlertDto }>;

/** Alerts center → Oil tab (`GET /maintenance/alerts`). Filters and page live in the URL. */
@Component({
  selector: 'app-oil-alerts-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DataTableComponent,
    PaginationComponent,
    EnumChipComponent,
    IconComponent,
    HasPermissionDirective,
    CairoDatePipe,
    KmPipe,
  ],
  templateUrl: './oil-alerts-tab.component.html',
  styleUrl: '../alerts-table.scss',
})
export class OilAlertsTabComponent {
  private readonly api = inject(AlertsApi);
  private readonly auth = inject(AuthService);
  private readonly hub = inject(DashboardHubService);
  private readonly toast = inject(ToastService);

  /** Something was acknowledged — the page refreshes its counters. */
  readonly changed = output<void>();

  protected readonly P = PERMISSIONS;
  protected readonly LEVEL = MAINTENANCE_ALERT_LEVEL;
  protected readonly STATUS = MAINTENANCE_ALERT_STATUS;
  protected readonly levelKm = (level: string): string =>
    (OIL_LEVEL_KM as Record<string, string>)[level] ?? '';
  protected readonly levelOptions = enumOptions(MAINTENANCE_ALERT_LEVEL);
  protected readonly statusOptions = enumOptions(MAINTENANCE_ALERT_STATUS);
  protected readonly motorcycleLink = (id: string) => APP_ROUTES.motorcycle(id);
  protected readonly driverLink = APP_ROUTES.driver;

  protected readonly filters = injectUrlState<OilAlertsQuery>(OIL_ALERTS_QUERY_DEFAULTS);
  protected readonly f = this.filters.state;

  protected readonly canPickOffice = computed(() => !!this.auth.currentUser()?.hasGlobalScope);
  protected readonly offices = toSignal(inject(LookupService).offices(), { initialValue: [] });

  protected readonly alerts = createResource(
    () => this.f(),
    (q) => this.api.oilAlerts(q),
    {
      refetchOn: merge(
        this.hub.reconnected$,
        this.hub.notification$.pipe(filter(isOilNotification)),
      ),
    },
  );
  protected readonly rows = computed(() => this.alerts.value()?.data ?? []);
  protected readonly page = computed(() => this.alerts.value());

  protected readonly hasFilters = computed(() => {
    const f = this.f();
    return !!(f.level || f.status || f.officeId || !f.openOnly);
  });

  protected readonly busyId = signal<string | null>(null);

  private readonly plateTpl = viewChild<Row>('plateTpl');
  private readonly driverTpl = viewChild<Row>('driverTpl');
  private readonly levelTpl = viewChild<Row>('levelTpl');
  private readonly kmTpl = viewChild<Row>('kmTpl');
  private readonly raisedTpl = viewChild<Row>('raisedTpl');
  private readonly statusTpl = viewChild<Row>('statusTpl');
  private readonly actionsTpl = viewChild<Row>('actionsTpl');

  protected readonly columns = computed<TableColumn<MaintenanceAlertDto>[]>(() => [
    { key: 'plateNumber', label: 'الموتوسيكل', cellTemplate: this.plateTpl() },
    { key: 'driverName', label: 'السائق', cellTemplate: this.driverTpl() },
    { key: 'level', label: 'المستوى', cellTemplate: this.levelTpl() },
    { key: 'kmSinceOilChange', label: 'كم منذ آخر تغيير', cellTemplate: this.kmTpl() },
    { key: 'raisedAtUtc', label: 'وقت التنبيه', cellTemplate: this.raisedTpl() },
    { key: 'status', label: 'الحالة', cellTemplate: this.statusTpl() },
    { key: 'actions', label: '', align: 'end', cellTemplate: this.actionsTpl() },
  ]);

  protected select(field: 'level' | 'status' | 'officeId', event: Event): void {
    this.filters.patch({
      [field]: (event.target as HTMLSelectElement).value,
    } as Partial<OilAlertsQuery>);
  }

  protected toggleOpenOnly(event: Event): void {
    this.filters.patch({ openOnly: (event.target as HTMLInputElement).checked });
  }

  protected acknowledge(a: MaintenanceAlertDto): void {
    this.busyId.set(a.id);
    this.api.acknowledgeAlert(a.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success('تم تسجيل الاطلاع على التنبيه');
        this.alerts.reload();
        this.changed.emit();
      },
      error: () => this.busyId.set(null),
    });
  }
}
