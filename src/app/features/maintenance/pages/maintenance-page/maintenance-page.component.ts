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
import { catchError, forkJoin, map, merge, of } from 'rxjs';
import { AuthService } from '@core/auth/services/auth.service';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { LookupService } from '@core/data/lookup.service';
import { createResource } from '@core/data/resource';
import { injectUrlState } from '@core/routing/url-state';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { APP_ROUTES } from '@core/constants/app-routes';
import {
  MAINTENANCE_STATUS,
  MAINTENANCE_TYPE,
  MaintenanceStatus,
  MaintenanceType,
  enumOptions,
} from '@core/constants/enums';
import { MaintenanceRecordDto } from '@core/models/domain.models';
import {
  DataTableComponent,
  TableColumn,
} from '@shared/components/data-table/data-table.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { TabItem, TabsComponent } from '@shared/components/tabs/tabs.component';
import { ChipComponent, EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { FORMAT_PIPES } from '@shared/pipes/format.pipes';
import { PickerOption } from '@shared/components/remote-picker/remote-picker.component';
import { MaintenanceApi } from '../../data-access/maintenance.api';
import {
  MAINTENANCE_PAGE_DEFAULTS,
  MaintenancePageState,
  MaintenanceRecordsQuery,
  MaintenanceView,
  QUEUE_STATUSES,
  QueueStatus,
  isReturned,
  recordTotal,
} from '../../models/maintenance.models';
import { RecordFormDialogComponent } from '../../components/record-form-dialog/record-form-dialog.component';

type Row = TemplateRef<{ $implicit: MaintenanceRecordDto }>;

/** Rows scanned to count "returned by supervisor" (it isn't a server-side filter). */
const RETURNED_SCAN = 100;

interface Counters {
  scheduled: number;
  inProgress: number;
  awaiting: number;
  /** Open repairs carrying a supervisor reject reason (scan of the first RETURNED_SCAN rows). */
  returned: number;
}

/**
 * 5.7 — Maintenance. Two views in the URL (`?view=queue|all`):
 *   - Repair queue: `type=Repair` records in one of the open statuses (tab).
 *   - All records: every record, filtered by status / type / office / bike / search.
 */
@Component({
  selector: 'app-maintenance-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTableComponent,
    PaginationComponent,
    PageHeaderComponent,
    SearchInputComponent,
    TabsComponent,
    ChipComponent,
    EnumChipComponent,
    IconComponent,
    HasPermissionDirective,
    RecordFormDialogComponent,
    ...FORMAT_PIPES,
  ],
  templateUrl: './maintenance-page.component.html',
  styleUrl: './maintenance-page.component.scss',
})
export class MaintenancePageComponent {
  private readonly api = inject(MaintenanceApi);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly hub = inject(DashboardHubService);

  protected readonly P = PERMISSIONS;
  protected readonly STATUS = MAINTENANCE_STATUS;
  protected readonly TYPE = MAINTENANCE_TYPE;
  protected readonly statusOptions = enumOptions(MAINTENANCE_STATUS);
  protected readonly typeOptions = enumOptions(MAINTENANCE_TYPE);
  protected readonly isReturned = isReturned;
  protected readonly total = recordTotal;

  protected readonly filters = injectUrlState<MaintenancePageState>(MAINTENANCE_PAGE_DEFAULTS);
  protected readonly f = this.filters.state;
  protected readonly view = computed<MaintenanceView>(() =>
    this.f().view === 'all' ? 'all' : 'queue',
  );
  protected readonly queueStatus = computed<QueueStatus>(() => {
    const q = this.f().queue;
    return (QUEUE_STATUSES as readonly string[]).includes(q) ? q : 'Scheduled';
  });

  protected readonly canPickOffice = computed(() => !!this.auth.currentUser()?.hasGlobalScope);
  protected readonly offices = toSignal(inject(LookupService).offices(), { initialValue: [] });

  /** Repairs move between statuses from other screens — refresh on hub notifications too. */
  private readonly refetch$ = merge(this.hub.reconnected$, this.hub.notification$);

  private readonly query = computed<MaintenanceRecordsQuery>(() => {
    const f = this.f();
    const base = {
      officeId: f.officeId,
      motorcycleId: f.motorcycleId,
      pageIndex: f.pageIndex,
      pageSize: f.pageSize,
      sortDesc: true,
    };
    return this.view() === 'queue'
      ? { ...base, status: this.queueStatus(), type: 'Repair' }
      : { ...base, status: f.status, type: f.type, search: f.search };
  });

  protected readonly records = createResource(
    () => this.query(),
    (q) => this.api.list(q),
    { refetchOn: this.refetch$ },
  );
  protected readonly rows = computed(() => this.records.value()?.data ?? []);
  protected readonly page = computed(() => this.records.value());

  /** Header counters, scoped like the list (office / bike). Best-effort: failures show "—". */
  private readonly counters = createResource(
    () => ({ officeId: this.f().officeId, motorcycleId: this.f().motorcycleId }),
    (scope) => {
      const q = (status: QueueStatus, pageSize: number) =>
        this.api.count({ ...scope, type: 'Repair', status, pageIndex: 1, pageSize });
      return forkJoin({
        scheduled: q('Scheduled', RETURNED_SCAN),
        inProgress: q('InProgress', RETURNED_SCAN),
        awaiting: q('AwaitingSupervisorApproval', 1),
      }).pipe(
        map((r): Counters => ({
          scheduled: r.scheduled.count,
          inProgress: r.inProgress.count,
          awaiting: r.awaiting.count,
          returned: [...r.scheduled.data, ...r.inProgress.data].filter(isReturned).length,
        })),
        catchError(() => of(null)),
      );
    },
    { refetchOn: this.refetch$ },
  );
  protected readonly counts = computed(() => this.counters.value() ?? null);

  protected readonly queueTabs = computed<TabItem[]>(() => {
    const c = this.counts();
    const badge: Record<QueueStatus, number | null> = {
      Scheduled: c?.scheduled ?? null,
      InProgress: c?.inProgress ?? null,
      AwaitingSupervisorApproval: c?.awaiting ?? null,
    };
    return QUEUE_STATUSES.map((s) => ({
      id: s,
      label: MAINTENANCE_STATUS[s].label,
      icon: MAINTENANCE_STATUS[s].icon,
      badge: badge[s],
    }));
  });

  protected readonly viewTabs: TabItem[] = [
    { id: 'queue', label: 'طابور الإصلاح', icon: 'wrench' },
    { id: 'all', label: 'كل السجلات', icon: 'file' },
  ];

  protected readonly hasFilters = computed(() => {
    const f = this.f();
    return this.view() === 'all'
      ? !!(f.status || f.type || f.search || f.officeId || f.motorcycleId)
      : !!(f.officeId || f.motorcycleId);
  });

  /** Plate for the "filtered by motorcycle" chip, taken from the loaded rows. */
  protected readonly motorcyclePlate = computed(() =>
    this.f().motorcycleId ? (this.rows()[0]?.plateNumber ?? '') : '',
  );

  protected readonly presetMotorcycle = computed<PickerOption | null>(() => {
    const id = this.f().motorcycleId;
    return id ? { value: id, label: this.motorcyclePlate() || '…' } : null;
  });

  protected readonly formOpen = signal(false);

  private readonly plateTpl = viewChild<Row>('plateTpl');
  private readonly statusTpl = viewChild<Row>('statusTpl');
  private readonly typeTpl = viewChild<Row>('typeTpl');
  private readonly faultsTpl = viewChild<Row>('faultsTpl');
  private readonly issueTpl = viewChild<Row>('issueTpl');
  private readonly dateTpl = viewChild<Row>('dateTpl');
  private readonly costTpl = viewChild<Row>('costTpl');

  protected readonly columns = computed<TableColumn<MaintenanceRecordDto>[]>(() => {
    const queue = this.view() === 'queue';
    return [
      { key: 'plateNumber', label: 'الموتوسيكل', cellTemplate: this.plateTpl() },
      ...(queue ? [] : [{ key: 'type', label: 'النوع', cellTemplate: this.typeTpl() }]),
      { key: 'status', label: 'الحالة', cellTemplate: this.statusTpl() },
      { key: 'issueDescription', label: 'المشكلة', cellTemplate: this.issueTpl() },
      { key: 'faults', label: 'الأعطال', align: 'center', cellTemplate: this.faultsTpl() },
      { key: 'scheduledAtUtc', label: 'التاريخ', cellTemplate: this.dateTpl() },
      { key: 'totalCost', label: 'التكلفة', align: 'end', cellTemplate: this.costTpl() },
    ] as TableColumn<MaintenanceRecordDto>[];
  });

  protected readonly emptyTitle = computed(() => {
    if (this.view() === 'all')
      return this.hasFilters() ? 'لا توجد نتائج مطابقة' : 'لا توجد سجلات صيانة بعد';
    switch (this.queueStatus()) {
      case 'AwaitingSupervisorApproval':
        return 'لا توجد إصلاحات بانتظار الاعتماد';
      case 'InProgress':
        return 'لا توجد إصلاحات جارية';
      default:
        return 'لا توجد إصلاحات جديدة';
    }
  });
  protected readonly emptyText = computed(() =>
    this.view() === 'queue'
      ? 'تظهر هنا الموتوسيكلات المستلمة بأعطال فور تسجيل فحص الاستلام.'
      : this.hasFilters()
        ? 'جرّب تغيير الفلاتر أو البحث'
        : '',
  );

  protected setView(view: string): void {
    this.filters.patch({ view: view as MaintenanceView });
  }

  protected setQueue(status: string): void {
    this.filters.patch({ view: 'queue', queue: status as QueueStatus });
  }

  protected select(field: 'status' | 'type' | 'officeId', event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (field === 'status') this.filters.patch({ status: value as MaintenanceStatus | '' });
    else if (field === 'type') this.filters.patch({ type: value as MaintenanceType | '' });
    else this.filters.patch({ officeId: value });
  }

  protected clearFilters(): void {
    this.filters.patch({ status: '', type: '', search: '', officeId: '', motorcycleId: '' });
  }

  protected open(r: MaintenanceRecordDto): void {
    void this.router.navigateByUrl(APP_ROUTES.maintenanceRecord(r.id));
  }

  protected onCreated(r: MaintenanceRecordDto): void {
    this.formOpen.set(false);
    if (r.id) this.open(r);
    else this.records.reload();
  }

  protected fixedCount(r: MaintenanceRecordDto): number {
    return (r.faults ?? []).filter((x) => x.isFixed).length;
  }
}
