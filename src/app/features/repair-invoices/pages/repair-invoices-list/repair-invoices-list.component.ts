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
import { catchError, map, merge, of } from 'rxjs';
import { AuthService } from '@core/auth/services/auth.service';
import { LookupService } from '@core/data/lookup.service';
import { createResource } from '@core/data/resource';
import { injectUrlState } from '@core/routing/url-state';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { APP_ROUTES } from '@core/constants/app-routes';
import { REPAIR_INVOICE_STATUS, RepairInvoiceStatus } from '@core/constants/enums';
import {
  DataTableComponent,
  TableColumn,
} from '@shared/components/data-table/data-table.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { TabItem, TabsComponent } from '@shared/components/tabs/tabs.component';
import { ChipComponent, EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { FORMAT_PIPES } from '@shared/pipes/format.pipes';
import { RepairInvoicesApi } from '../../data-access/repair-invoices.api';
import {
  ALL_STATUSES,
  REPAIR_INVOICES_DEFAULTS,
  RepairInvoiceDto,
  RepairInvoicesQuery,
  RepairInvoicesState,
} from '../../models/repair-invoice.models';

type Row = TemplateRef<{ $implicit: RepairInvoiceDto }>;

const STATUS_TABS: RepairInvoiceStatus[] = ['PendingDecision', 'ChargedToDriver', 'CompanyExpense'];

/** 5.11 — Repair invoices from the accounting program. Status tab, office, bike and page live in the URL. */
@Component({
  selector: 'app-repair-invoices-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DataTableComponent,
    PaginationComponent,
    PageHeaderComponent,
    TabsComponent,
    ChipComponent,
    EnumChipComponent,
    IconComponent,
    ...FORMAT_PIPES,
  ],
  templateUrl: './repair-invoices-list.component.html',
})
export class RepairInvoicesListComponent {
  private readonly api = inject(RepairInvoicesApi);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly hub = inject(DashboardHubService);

  protected readonly ROUTES = APP_ROUTES;
  protected readonly STATUS = REPAIR_INVOICE_STATUS;

  protected readonly filters = injectUrlState<RepairInvoicesState>(REPAIR_INVOICES_DEFAULTS);
  protected readonly f = this.filters.state;

  protected readonly canPickOffice = computed(() => !!this.auth.currentUser()?.hasGlobalScope);
  protected readonly offices = toSignal(inject(LookupService).offices(), { initialValue: [] });

  /** New invoices arrive as hub notifications. */
  private readonly refetch$ = merge(this.hub.reconnected$, this.hub.notification$);

  private readonly query = computed<RepairInvoicesQuery>(() => {
    const f = this.f();
    return {
      status: f.status === ALL_STATUSES ? '' : f.status,
      officeId: f.officeId,
      motorcycleId: f.motorcycleId,
      pageIndex: f.pageIndex,
      pageSize: f.pageSize,
    };
  });

  protected readonly invoices = createResource(
    () => this.query(),
    (q) => this.api.list(q),
    { refetchOn: this.refetch$ },
  );
  protected readonly rows = computed(() => this.invoices.value()?.data ?? []);
  protected readonly page = computed(() => this.invoices.value());

  private readonly pending = createResource(
    () => ({ officeId: this.f().officeId, motorcycleId: this.f().motorcycleId }),
    (scope) =>
      this.api.count({ ...scope, status: 'PendingDecision', pageIndex: 1, pageSize: 1 }).pipe(
        map((p) => p.count),
        catchError(() => of(null)),
      ),
    { refetchOn: this.refetch$ },
  );
  protected readonly pendingCount = computed(() => this.pending.value() ?? null);

  protected readonly tabs = computed<TabItem[]>(() => [
    ...STATUS_TABS.map((s) => ({
      id: s,
      label: REPAIR_INVOICE_STATUS[s].label,
      icon: REPAIR_INVOICE_STATUS[s].icon,
      badge: s === 'PendingDecision' ? this.pendingCount() : null,
    })),
    { id: ALL_STATUSES, label: 'الكل', icon: 'file' },
  ]);

  protected readonly motorcyclePlate = computed(() =>
    this.f().motorcycleId ? (this.rows()[0]?.plateNumber ?? '') : '',
  );

  private readonly numberTpl = viewChild<Row>('numberTpl');
  private readonly plateTpl = viewChild<Row>('plateTpl');
  private readonly amountTpl = viewChild<Row>('amountTpl');
  private readonly issuedTpl = viewChild<Row>('issuedTpl');
  private readonly driverTpl = viewChild<Row>('driverTpl');
  private readonly statusTpl = viewChild<Row>('statusTpl');
  private readonly repairTpl = viewChild<Row>('repairTpl');

  protected readonly columns = computed<TableColumn<RepairInvoiceDto>[]>(() => [
    { key: 'externalInvoiceNumber', label: 'رقم الفاتورة', cellTemplate: this.numberTpl() },
    { key: 'plateNumber', label: 'الموتوسيكل', cellTemplate: this.plateTpl() },
    { key: 'amount', label: 'المبلغ', align: 'end', cellTemplate: this.amountTpl() },
    { key: 'issuedAtUtc', label: 'تاريخ الإصدار', cellTemplate: this.issuedTpl() },
    { key: 'suggestedDriverName', label: 'السائق المقترح', cellTemplate: this.driverTpl() },
    { key: 'status', label: 'الحالة', cellTemplate: this.statusTpl() },
    {
      key: 'maintenanceRecordId',
      label: 'الإصلاح',
      align: 'center',
      cellTemplate: this.repairTpl(),
    },
  ]);

  protected readonly emptyTitle = computed(() =>
    this.f().status === 'PendingDecision' ? 'لا توجد فواتير بانتظار القرار' : 'لا توجد فواتير',
  );

  protected setStatus(status: string): void {
    this.filters.patch({ status: status as RepairInvoicesState['status'] });
  }

  protected selectOffice(event: Event): void {
    this.filters.patch({ officeId: (event.target as HTMLSelectElement).value });
  }

  protected clearMotorcycle(): void {
    this.filters.patch({ motorcycleId: '' });
  }

  protected open(i: RepairInvoiceDto): void {
    void this.router.navigateByUrl(APP_ROUTES.repairInvoice(i.id));
  }

  /** Links inside a clickable row must not also open the row. */
  protected stop(event: Event): void {
    event.stopPropagation();
  }
}
