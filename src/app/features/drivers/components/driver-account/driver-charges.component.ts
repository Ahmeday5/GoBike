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
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/services/auth.service';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { APP_ROUTES } from '@core/constants/app-routes';
import {
  DRIVER_CHARGE_SOURCE,
  DRIVER_CHARGE_STATUS,
  DriverChargeSource,
  DriverChargeStatus,
  enumOptions,
} from '@core/constants/enums';
import { createResource } from '@core/data/resource';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { injectUrlState } from '@core/routing/url-state';
import { ConfirmDialogConfig } from '@core/services/dialog.service';
import { formatMoney } from '@core/utils/format.util';
import {
  DataTableComponent,
  TableColumn,
} from '@shared/components/data-table/data-table.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ReasonDialogComponent } from '@shared/components/reason-dialog/reason-dialog.component';
import { CairoDatePipe, MoneyPipe } from '@shared/pipes/format.pipes';
import { DriverLedgerApi } from '../../data-access/driver-ledger.api';
import { DriverChargeDto } from '../../models/ledger.models';
import { canCancelCharge, chargeRemaining } from './ledger.util';

type Row = TemplateRef<{ $implicit: DriverChargeDto }>;

type ChargesUrlState = {
  chStatus: DriverChargeStatus | '';
  chSource: DriverChargeSource | '';
  chPage: number;
};

/**
 * Account tab → charges (`GET /drivers/{id}/charges`). Status/source filters
 * are chip toggles kept in the URL (`chStatus`, `chSource`, `chPage`) so they
 * don't collide with the other driver tabs' query params.
 */
@Component({
  selector: 'app-driver-charges',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DataTableComponent,
    PaginationComponent,
    EnumChipComponent,
    IconComponent,
    ReasonDialogComponent,
    CairoDatePipe,
    MoneyPipe,
  ],
  template: `
    <section class="panel" style="--i: 2">
      <header class="panel__head">
        <h2 class="panel__title"><app-icon name="file" [size]="18" />المديونيات</h2>
      </header>

      <div class="ac-chips" role="group" aria-label="تصفية حسب الحالة">
        <span class="ac-chips__label">الحالة</span>
        <button
          type="button"
          class="ac-chip"
          [class.ac-chip--on]="!state().chStatus"
          [attr.aria-pressed]="!state().chStatus"
          (click)="setStatus('')"
        >
          الكل
        </button>
        @for (o of statusOptions; track o.value) {
          <button
            type="button"
            class="ac-chip"
            [class.ac-chip--on]="state().chStatus === o.value"
            [attr.aria-pressed]="state().chStatus === o.value"
            (click)="setStatus(o.value)"
          >
            <app-enum-chip [map]="STATUS" [value]="o.value" [small]="true" />
          </button>
        }
      </div>
      <div class="ac-chips" role="group" aria-label="تصفية حسب المصدر">
        <span class="ac-chips__label">المصدر</span>
        <button
          type="button"
          class="ac-chip"
          [class.ac-chip--on]="!state().chSource"
          [attr.aria-pressed]="!state().chSource"
          (click)="setSource('')"
        >
          الكل
        </button>
        @for (o of sourceOptions; track o.value) {
          <button
            type="button"
            class="ac-chip"
            [class.ac-chip--on]="state().chSource === o.value"
            [attr.aria-pressed]="state().chSource === o.value"
            (click)="setSource(o.value)"
          >
            <app-enum-chip [map]="SOURCE" [value]="o.value" [small]="true" />
          </button>
        }
      </div>

      @if (charges.error(); as err) {
        <div
          class="alert alert-danger d-flex justify-content-between align-items-center"
          role="alert"
        >
          <span>{{ err.message }}</span>
          <button type="button" class="btn btn-sm" (click)="charges.reload()">
            إعادة المحاولة
          </button>
        </div>
      }

      <app-data-table
        [columns]="columns()"
        [data]="rows()"
        [loading]="charges.loading()"
        emptyIcon="check-circle"
        [emptyTitle]="hasFilters() ? 'لا توجد مديونيات مطابقة' : 'لا توجد مديونيات على هذا السائق'"
      />
      @if (charges.value(); as p) {
        @if (p.totalPages > 1) {
          <app-pagination
            [pageIndex]="state().chPage"
            [pageSize]="pageSize"
            [count]="p.count"
            [totalPages]="p.totalPages"
            [showPageSize]="false"
            [disabled]="charges.loading()"
            (pageChange)="url.patch({ chPage: $event })"
          />
        }
      }
    </section>

    <app-reason-dialog
      [open]="!!cancelling()"
      title="إلغاء المديونية"
      label="سبب الإلغاء"
      [message]="cancelMessage()"
      confirmText="إلغاء المديونية"
      successMessage="تم إلغاء المديونية"
      [action]="cancelAction"
      [confirm]="cancelConfirm()"
      (closed)="cancelling.set(null)"
      (done)="onCancelled()"
    />

    <ng-template #dateTpl let-c>{{
      c.chargedAtUtc ?? c.createdAtUtc | cairoDate: 'date'
    }}</ng-template>
    <ng-template #sourceTpl let-c>
      <app-enum-chip [map]="SOURCE" [value]="c.source" [small]="true" />
    </ng-template>
    <ng-template #descTpl let-c>
      <span class="ac-desc">{{ c.description || '—' }}</span>
      @if (c.motorcycleId) {
        <a class="link-btn ltr ac-plate" [routerLink]="motorcycleLink(c.motorcycleId)">
          {{ c.plateNumber || 'الموتوسيكل' }}
        </a>
      }
      @if (c.status === 'Cancelled' && c.cancelReason) {
        <div class="muted ac-sub">سبب الإلغاء: {{ c.cancelReason }}</div>
      }
    </ng-template>
    <ng-template #amountTpl let-c
      ><span class="amount">{{ c.amount | money }}</span></ng-template
    >
    <ng-template #remainingTpl let-c>
      @if (remaining(c) > 0) {
        <span class="amount amount--debt">{{ remaining(c) | money }}</span>
      } @else {
        <span class="muted">—</span>
      }
    </ng-template>
    <ng-template #statusTpl let-c>
      <app-enum-chip [map]="STATUS" [value]="c.status" [small]="true" />
    </ng-template>
    <ng-template #actionsTpl let-c>
      @if (canCancel(c)) {
        <button type="button" class="btn btn-ghost btn-sm ac-danger" (click)="cancelling.set(c)">
          <app-icon name="ban" [size]="14" />
          إلغاء
        </button>
      }
    </ng-template>
  `,
  styleUrl: './driver-account.shared.scss',
})
export class DriverChargesComponent {
  private readonly api = inject(DriverLedgerApi);
  private readonly auth = inject(AuthService);

  readonly driverId = input.required<string>();
  /** Bumped by the parent after any ledger action → reload. */
  readonly version = input(0);
  /** A charge was cancelled (the parent refreshes balance + statement). */
  readonly changed = output<void>();

  protected readonly STATUS = DRIVER_CHARGE_STATUS;
  protected readonly SOURCE = DRIVER_CHARGE_SOURCE;
  protected readonly statusOptions = enumOptions(DRIVER_CHARGE_STATUS);
  protected readonly sourceOptions = enumOptions(DRIVER_CHARGE_SOURCE);
  protected readonly pageSize = 10;

  protected readonly url = injectUrlState<ChargesUrlState>({
    chStatus: '',
    chSource: '',
    chPage: 1,
  });
  protected readonly state = this.url.state;
  protected readonly hasFilters = computed(
    () => !!(this.state().chStatus || this.state().chSource),
  );

  protected readonly charges = createResource(
    () => ({ id: this.driverId(), s: this.state(), v: this.version() }),
    ({ id, s }) =>
      this.api.charges(id, {
        status: s.chStatus,
        source: s.chSource,
        pageIndex: s.chPage,
        pageSize: this.pageSize,
      }),
    { refetchOn: inject(DashboardHubService).reconnected$ },
  );
  protected readonly rows = computed(() => this.charges.value()?.data ?? []);

  private readonly canManage = computed(() =>
    this.auth.hasPermission(PERMISSIONS.DriverPayments.Manage),
  );

  private readonly dateTpl = viewChild<Row>('dateTpl');
  private readonly sourceTpl = viewChild<Row>('sourceTpl');
  private readonly descTpl = viewChild<Row>('descTpl');
  private readonly amountTpl = viewChild<Row>('amountTpl');
  private readonly remainingTpl = viewChild<Row>('remainingTpl');
  private readonly statusTpl = viewChild<Row>('statusTpl');
  private readonly actionsTpl = viewChild<Row>('actionsTpl');

  protected readonly columns = computed<TableColumn<DriverChargeDto>[]>(() => [
    { key: 'chargedAtUtc', label: 'التاريخ', cellTemplate: this.dateTpl() },
    { key: 'source', label: 'المصدر', cellTemplate: this.sourceTpl() },
    { key: 'description', label: 'الوصف', cellTemplate: this.descTpl() },
    { key: 'amount', label: 'المبلغ', align: 'end', cellTemplate: this.amountTpl() },
    { key: 'remainingAmount', label: 'المتبقي', align: 'end', cellTemplate: this.remainingTpl() },
    { key: 'status', label: 'الحالة', cellTemplate: this.statusTpl() },
    ...(this.canManage()
      ? [{ key: 'actions', label: '', align: 'end' as const, cellTemplate: this.actionsTpl() }]
      : []),
  ]);

  // ── cancel ──
  protected readonly cancelling = signal<DriverChargeDto | null>(null);
  protected readonly cancelMessage = computed(() => {
    const c = this.cancelling();
    return c ? `مديونية بمبلغ ${formatMoney(c.amount)}: ${c.description || '—'}` : '';
  });
  protected readonly cancelConfirm = computed<ConfirmDialogConfig | null>(() => {
    const c = this.cancelling();
    if (!c) return null;
    return {
      title: 'تأكيد إلغاء المديونية',
      message: `ستُلغى مديونية بمبلغ ${formatMoney(c.amount)} وتُخصم من إجمالي مديونية السائق. لا يمكن التراجع عن الإلغاء.`,
      type: 'danger',
      confirmText: `إلغاء ${formatMoney(c.amount)}`,
    };
  });
  protected readonly cancelAction = (reason: string) =>
    this.api.cancelCharge(this.cancelling()?.id ?? '', { reason });

  protected setStatus(chStatus: DriverChargeStatus | ''): void {
    this.url.patch({ chStatus, chPage: 1 });
  }

  protected setSource(chSource: DriverChargeSource | ''): void {
    this.url.patch({ chSource, chPage: 1 });
  }

  protected remaining(c: DriverChargeDto): number {
    return chargeRemaining(c);
  }

  protected canCancel(c: DriverChargeDto): boolean {
    return canCancelCharge(c);
  }

  protected motorcycleLink(id: string) {
    return APP_ROUTES.motorcycle(id);
  }

  protected onCancelled(): void {
    this.cancelling.set(null);
    this.changed.emit();
  }
}
