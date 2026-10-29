import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { filter, merge } from 'rxjs';
import { AuthService } from '@core/auth/services/auth.service';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { APP_ROUTES } from '@core/constants/app-routes';
import { GPS_INCIDENT_TYPE, INCIDENT_STATUS, enumOptions } from '@core/constants/enums';
import { LookupService } from '@core/data/lookup.service';
import { createResource } from '@core/data/resource';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { injectUrlState } from '@core/routing/url-state';
import { ToastService } from '@core/services/toast.service';
import { cairoInputToUtc } from '@core/utils/cairo-time.util';
import {
  DataTableComponent,
  TableColumn,
} from '@shared/components/data-table/data-table.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { CairoDatePipe } from '@shared/pipes/format.pipes';
import { AlertsApi } from '../../data-access/alerts.api';
import {
  AUTO_RESOLVING_TYPES,
  GpsIncidentDto,
  INCIDENTS_QUERY_DEFAULTS,
  IncidentsParams,
  IncidentsQuery,
  NON_ZONE_INCIDENT_TYPES,
  SUSPECTED_POWER_HINT,
  incidentStartedAt,
  isIncidentNotification,
} from '../../models/alerts.models';
import { ResolveIncidentDialogComponent } from '../resolve-incident-dialog/resolve-incident-dialog.component';

type Row = TemplateRef<{ $implicit: GpsIncidentDto }>;

/**
 * Alerts center → "GPS & power" (`mode="gps"`) and "Zone" (`mode="zone"`) tabs,
 * both on `GET /gps/incidents`.
 *
 * The API filters by a single `type`, so the GPS tab cannot exclude zone
 * exits server-side: its type filter offers only non-zone types, and with no
 * type picked it lists every incident type (zone rows included, recognisable
 * by their chip). Filtering zone rows out on the client would break paging.
 */
@Component({
  selector: 'app-incidents-tab',
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
    ResolveIncidentDialogComponent,
  ],
  templateUrl: './incidents-tab.component.html',
  styleUrl: '../alerts-table.scss',
})
export class IncidentsTabComponent {
  private readonly api = inject(AlertsApi);
  private readonly auth = inject(AuthService);
  private readonly hub = inject(DashboardHubService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly mode = input.required<'gps' | 'zone'>();
  /** Something was acknowledged/resolved — the page refreshes its counters. */
  readonly changed = output<void>();

  protected readonly P = PERMISSIONS;
  protected readonly TYPE = GPS_INCIDENT_TYPE;
  protected readonly STATUS = INCIDENT_STATUS;
  protected readonly SUSPECTED_HINT = SUSPECTED_POWER_HINT;
  protected readonly typeOptions = enumOptions(GPS_INCIDENT_TYPE).filter((o) =>
    NON_ZONE_INCIDENT_TYPES.includes(o.value),
  );
  protected readonly statusOptions = enumOptions(INCIDENT_STATUS);
  protected readonly startedAt = incidentStartedAt;
  protected readonly motorcycleLink = (id: string) => APP_ROUTES.motorcycle(id);

  protected readonly filters = injectUrlState<IncidentsQuery>(INCIDENTS_QUERY_DEFAULTS);
  protected readonly f = this.filters.state;

  protected readonly canPickOffice = computed(() => !!this.auth.currentUser()?.hasGlobalScope);
  protected readonly offices = toSignal(inject(LookupService).offices(), { initialValue: [] });

  private readonly params = computed<IncidentsParams>(() => {
    const f = this.f();
    return {
      unresolvedOnly: f.unresolvedOnly,
      type: this.mode() === 'zone' ? 'OutOfZone' : f.type,
      status: f.status,
      officeId: f.officeId,
      fromUtc: cairoInputToUtc(f.from),
      toUtc: cairoInputToUtc(f.to),
      pageIndex: f.pageIndex,
      pageSize: f.pageSize,
    };
  });

  protected readonly incidents = createResource(
    () => this.params(),
    (p) => this.api.incidents(p),
    {
      refetchOn: merge(
        this.hub.reconnected$,
        this.hub.notification$.pipe(filter(isIncidentNotification)),
      ),
    },
  );
  protected readonly rows = computed(() => this.incidents.value()?.data ?? []);
  protected readonly page = computed(() => this.incidents.value());

  protected readonly hasFilters = computed(() => {
    const f = this.f();
    return !!(
      (this.mode() === 'gps' && f.type) ||
      f.status ||
      f.officeId ||
      f.from ||
      f.to ||
      !f.unresolvedOnly
    );
  });

  protected readonly busyId = signal<string | null>(null);
  protected readonly resolving = signal<GpsIncidentDto | null>(null);

  private readonly plateTpl = viewChild<Row>('plateTpl');
  private readonly typeTpl = viewChild<Row>('typeTpl');
  private readonly statusTpl = viewChild<Row>('statusTpl');
  private readonly startedTpl = viewChild<Row>('startedTpl');
  private readonly lastSeenTpl = viewChild<Row>('lastSeenTpl');
  private readonly actionsTpl = viewChild<Row>('actionsTpl');

  protected readonly columns = computed<TableColumn<GpsIncidentDto>[]>(() => [
    { key: 'plateNumber', label: 'الموتوسيكل', cellTemplate: this.plateTpl() },
    { key: 'type', label: 'النوع', cellTemplate: this.typeTpl() },
    { key: 'status', label: 'الحالة', cellTemplate: this.statusTpl() },
    { key: 'startedAtUtc', label: 'بدأت', cellTemplate: this.startedTpl() },
    { key: 'lastSeenAtUtc', label: 'آخر ظهور', cellTemplate: this.lastSeenTpl() },
    { key: 'actions', label: '', align: 'end', cellTemplate: this.actionsTpl() },
  ]);

  protected select(field: 'type' | 'status' | 'officeId', event: Event): void {
    this.filters.patch({
      [field]: (event.target as HTMLSelectElement).value,
    } as Partial<IncidentsQuery>);
  }

  protected setRange(field: 'from' | 'to', event: Event): void {
    this.filters.patch({ [field]: (event.target as HTMLInputElement).value });
  }

  protected toggleUnresolved(event: Event): void {
    this.filters.patch({ unresolvedOnly: (event.target as HTMLInputElement).checked });
  }

  protected autoResolves(i: GpsIncidentDto): boolean {
    return i.status !== 'Resolved' && AUTO_RESOLVING_TYPES.includes(i.type);
  }

  protected open(i: GpsIncidentDto): void {
    void this.router.navigateByUrl(APP_ROUTES.incident(i.id));
  }

  protected acknowledge(i: GpsIncidentDto): void {
    this.busyId.set(i.id);
    this.api.acknowledgeIncident(i.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success('تم تسجيل الاطلاع على الحادثة');
        this.incidents.reload();
        this.changed.emit();
      },
      error: () => this.busyId.set(null),
    });
  }

  protected onResolved(): void {
    this.resolving.set(null);
    this.incidents.reload();
    this.changed.emit();
  }
}
