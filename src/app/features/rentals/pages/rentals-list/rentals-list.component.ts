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
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '@core/auth/services/auth.service';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { APP_ROUTES } from '@core/constants/app-routes';
import { RENTAL_STATUS, RENT_PERIOD, enumLabel, enumOptions } from '@core/constants/enums';
import { LookupService } from '@core/data/lookup.service';
import { createResource } from '@core/data/resource';
import { RentalDto } from '@core/models/domain.models';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { injectUrlState } from '@core/routing/url-state';
import {
  DataTableComponent,
  SortState,
  TableColumn,
} from '@shared/components/data-table/data-table.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { CairoDatePipe, MoneyPipe } from '@shared/pipes/format.pipes';
import { RentalsApi } from '../../data-access/rentals.api';
import {
  RENTALS_QUERY_DEFAULTS,
  RentalsQuery,
  ScopeChip,
  isRentalCancellable,
} from '../../models/rental.models';
import { StartRentalDialogComponent } from '../../components/start-rental-dialog/start-rental-dialog.component';
import { ReturnRentalDialogComponent } from '../../components/return-rental-dialog/return-rental-dialog.component';
import { CancelRentalDialogComponent } from '../../components/cancel-rental-dialog/cancel-rental-dialog.component';
import { RentalTermsDialogComponent } from '../../components/rental-terms-dialog/rental-terms-dialog.component';

type Row = TemplateRef<{ $implicit: RentalDto }>;

/**
 * 5.6 — Rentals list. Filters, page and sort live in the URL; `?motorcycleId=`
 * / `?driverId=` (deep links from the bike and driver pages) show as
 * removable chips.
 */
@Component({
  selector: 'app-rentals-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DataTableComponent,
    PaginationComponent,
    PageHeaderComponent,
    SearchInputComponent,
    EnumChipComponent,
    IconComponent,
    HasPermissionDirective,
    CairoDatePipe,
    MoneyPipe,
    StartRentalDialogComponent,
    ReturnRentalDialogComponent,
    CancelRentalDialogComponent,
    RentalTermsDialogComponent,
  ],
  templateUrl: './rentals-list.component.html',
  styleUrl: './rentals-list.component.scss',
})
export class RentalsListComponent {
  private readonly api = inject(RentalsApi);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly hub = inject(DashboardHubService);

  protected readonly P = PERMISSIONS;
  protected readonly STATUS = RENTAL_STATUS;
  protected readonly statusOptions = enumOptions(RENTAL_STATUS);

  protected readonly filters = injectUrlState<RentalsQuery>(RENTALS_QUERY_DEFAULTS);
  protected readonly f = this.filters.state;

  protected readonly canPickOffice = computed(() => !!this.auth.currentUser()?.hasGlobalScope);
  protected readonly offices = toSignal(inject(LookupService).offices(), { initialValue: [] });

  protected readonly can = computed(() => ({
    manage: this.auth.hasPermission(PERMISSIONS.Assignments.Manage),
    inspect: this.auth.hasPermission(PERMISSIONS.Inspections.Manage),
    motorcycles: this.auth.hasPermission(PERMISSIONS.Motorcycles.Read),
    drivers: this.auth.hasPermission(PERMISSIONS.Drivers.Read),
  }));

  protected readonly rentals = createResource(
    () => this.f(),
    (q) => this.api.list(q),
    { refetchOn: this.hub.reconnected$ },
  );
  protected readonly rows = computed(() => this.rentals.value()?.data ?? []);
  protected readonly page = computed(() => this.rentals.value());

  /** Cheap counter: one `pageSize=1` request for the active total (same office scope). */
  private readonly activeTick = signal(0);
  protected readonly activeCount = createResource(
    () => ({ officeId: this.f().officeId, tick: this.activeTick() }),
    ({ officeId }) =>
      this.api
        .list({ ...RENTALS_QUERY_DEFAULTS, status: 'Active', officeId, pageSize: 1 })
        .pipe(map((p) => p.count)),
    { refetchOn: this.hub.reconnected$ },
  );
  protected readonly subtitle = computed(() => {
    const n = this.activeCount.value();
    return n === undefined ? 'تسليم واستلام الموتوسيكلات للسائقين' : `${n} إيجار سارٍ الآن`;
  });

  protected readonly hasFilters = computed(() => {
    const f = this.f();
    return !!(f.search || f.status || f.officeId || f.from || f.to || f.motorcycleId || f.driverId);
  });

  /** Labels come from the loaded rows — no extra lookup request. */
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

  // ── dialogs ──
  protected readonly startOpen = signal(false);
  protected readonly returning = signal<RentalDto | null>(null);
  protected readonly cancelling = signal<RentalDto | null>(null);
  protected readonly editing = signal<RentalDto | null>(null);

  private readonly plateTpl = viewChild<Row>('plateTpl');
  private readonly driverTpl = viewChild<Row>('driverTpl');
  private readonly statusTpl = viewChild<Row>('statusTpl');
  private readonly startTpl = viewChild<Row>('startTpl');
  private readonly endTpl = viewChild<Row>('endTpl');
  private readonly rentTpl = viewChild<Row>('rentTpl');
  private readonly depositTpl = viewChild<Row>('depositTpl');
  private readonly contractTpl = viewChild<Row>('contractTpl');
  private readonly actionsTpl = viewChild<Row>('actionsTpl');

  protected readonly columns = computed<TableColumn<RentalDto>[]>(() => {
    const cols: TableColumn<RentalDto>[] = [
      { key: 'plateNumber', label: 'الموتوسيكل', cellTemplate: this.plateTpl() },
      { key: 'driverName', label: 'السائق', cellTemplate: this.driverTpl() },
      { key: 'status', label: 'الحالة', sortKey: 'status', cellTemplate: this.statusTpl() },
      { key: 'startAtUtc', label: 'البداية', sortKey: 'startAt', cellTemplate: this.startTpl() },
      { key: 'endAtUtc', label: 'النهاية', sortKey: 'endAt', cellTemplate: this.endTpl() },
      {
        key: 'rentAmount',
        label: 'الإيجار',
        sortKey: 'rentAmount',
        cellTemplate: this.rentTpl(),
      },
      { key: 'depositAmount', label: 'التأمين', cellTemplate: this.depositTpl() },
      { key: 'contractNumber', label: 'رقم العقد', cellTemplate: this.contractTpl() },
    ];
    const { manage, inspect } = this.can();
    if (manage || inspect) {
      cols.push({ key: 'actions', label: '', align: 'end', cellTemplate: this.actionsTpl() });
    }
    return cols;
  });

  protected select(field: keyof RentalsQuery, event: Event): void {
    this.filters.patch({
      [field]: (event.target as HTMLSelectElement | HTMLInputElement).value,
    } as Partial<RentalsQuery>);
  }

  protected clearScope(key: ScopeChip['key']): void {
    this.filters.patch({ [key]: '' });
  }

  protected sort(s: SortState): void {
    this.filters.patch({ sortBy: s.sortBy as RentalsQuery['sortBy'], sortDesc: s.sortDesc });
  }

  protected periodLabel(p: string): string {
    return enumLabel(RENT_PERIOD, p);
  }

  protected cancellable(r: RentalDto): boolean {
    return isRentalCancellable(r);
  }

  protected motorcycleLink(id: string) {
    return APP_ROUTES.motorcycle(id);
  }

  protected driverLink(id: string): string {
    return APP_ROUTES.driver(id);
  }

  protected open(r: RentalDto): void {
    void this.router.navigateByUrl(APP_ROUTES.rental(r.id));
  }

  protected onStarted(r: RentalDto): void {
    this.startOpen.set(false);
    if (r?.id) {
      void this.router.navigateByUrl(APP_ROUTES.rental(r.id));
    } else {
      this.refresh();
    }
  }

  /** The return dialog stays open on its result screen; only the data refreshes. */
  protected onReturned(): void {
    this.refresh();
  }

  protected onCancelled(): void {
    this.cancelling.set(null);
    this.refresh();
  }

  protected onTermsSaved(): void {
    this.editing.set(null);
    this.rentals.reload();
  }

  private refresh(): void {
    this.rentals.reload();
    this.activeTick.update((n) => n + 1);
  }
}
