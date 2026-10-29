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
import { AuthService } from '@core/auth/services/auth.service';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { PAYMENT_METHOD } from '@core/constants/enums';
import { createResource } from '@core/data/resource';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { injectUrlState } from '@core/routing/url-state';
import { ConfirmDialogConfig } from '@core/services/dialog.service';
import { formatCairo } from '@core/utils/cairo-time.util';
import { formatMoney } from '@core/utils/format.util';
import {
  DataTableComponent,
  TableColumn,
} from '@shared/components/data-table/data-table.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { ChipComponent, EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ReasonDialogComponent } from '@shared/components/reason-dialog/reason-dialog.component';
import { CairoDatePipe, MoneyPipe } from '@shared/pipes/format.pipes';
import { DriverLedgerApi } from '../../data-access/driver-ledger.api';
import { DriverPaymentDto } from '../../models/ledger.models';

type Row = TemplateRef<{ $implicit: DriverPaymentDto }>;

/**
 * Account tab → payments (`GET /drivers/{id}/payments`). Voided payments are
 * hidden unless `?payVoided=true`; voiding re-opens the debts the payment had
 * settled, so it goes through a reason + an amount-stating confirmation.
 */
@Component({
  selector: 'app-driver-payments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTableComponent,
    PaginationComponent,
    ChipComponent,
    EnumChipComponent,
    IconComponent,
    ReasonDialogComponent,
    CairoDatePipe,
    MoneyPipe,
  ],
  template: `
    <section class="panel" style="--i: 3">
      <header class="panel__head">
        <h2 class="panel__title"><app-icon name="cash" [size]="18" />الدفعات</h2>
        <div class="form-check form-switch m-0">
          <input
            id="ap-voided"
            class="form-check-input"
            type="checkbox"
            role="switch"
            [checked]="state().payVoided"
            (change)="toggleVoided($event)"
          />
          <label class="form-check-label ac-switch-label" for="ap-voided"
            >عرض الدفعات الملغاة</label
          >
        </div>
      </header>

      @if (payments.error(); as err) {
        <div
          class="alert alert-danger d-flex justify-content-between align-items-center"
          role="alert"
        >
          <span>{{ err.message }}</span>
          <button type="button" class="btn btn-sm" (click)="payments.reload()">
            إعادة المحاولة
          </button>
        </div>
      }

      <app-data-table
        [columns]="columns()"
        [data]="rows()"
        [loading]="payments.loading()"
        emptyIcon="cash"
        emptyTitle="لا توجد دفعات مسجلة"
      />
      @if (payments.value(); as p) {
        @if (p.totalPages > 1) {
          <app-pagination
            [pageIndex]="state().payPage"
            [pageSize]="pageSize"
            [count]="p.count"
            [totalPages]="p.totalPages"
            [showPageSize]="false"
            [disabled]="payments.loading()"
            (pageChange)="url.patch({ payPage: $event })"
          />
        }
      }
    </section>

    <app-reason-dialog
      [open]="!!voiding()"
      title="إلغاء الدفعة"
      label="سبب الإلغاء"
      [message]="voidMessage()"
      confirmText="إلغاء الدفعة"
      successMessage="تم إلغاء الدفعة"
      [action]="voidAction"
      [confirm]="voidConfirm()"
      (closed)="voiding.set(null)"
      (done)="onVoided()"
    />

    <ng-template #dateTpl let-p>
      <span [class.ac-struck]="p.isVoided">{{ p.paidAtUtc | cairoDate }}</span>
    </ng-template>
    <ng-template #amountTpl let-p>
      <span class="amount" [class.amount--credit]="!p.isVoided" [class.ac-struck]="p.isVoided">
        {{ p.amount | money }}
      </span>
      @if (!p.isVoided && p.unallocatedAmount) {
        <div class="muted ac-sub">منها {{ p.unallocatedAmount | money }} رصيد دائن</div>
      }
    </ng-template>
    <ng-template #methodTpl let-p>
      <app-enum-chip [map]="METHOD" [value]="p.method" [small]="true" />
    </ng-template>
    <ng-template #refTpl let-p>
      <span class="ltr">{{ p.reference || '—' }}</span>
      @if (p.notes) {
        <div class="muted ac-sub" [attr.title]="p.notes">{{ p.notes }}</div>
      }
    </ng-template>
    <ng-template #byTpl let-p>{{ p.recordedByName || '—' }}</ng-template>
    <ng-template #stateTpl let-p>
      @if (p.isVoided) {
        <span [attr.title]="p.voidReason || null">
          <app-chip tone="neutral" icon="ban" [small]="true">ملغاة</app-chip>
        </span>
        @if (p.voidReason) {
          <div class="muted ac-sub">{{ p.voidReason }}</div>
        }
      } @else {
        <app-chip tone="success" icon="check-circle" [small]="true">سارية</app-chip>
      }
    </ng-template>
    <ng-template #actionsTpl let-p>
      @if (!p.isVoided) {
        <button type="button" class="btn btn-ghost btn-sm ac-danger" (click)="voiding.set(p)">
          <app-icon name="ban" [size]="14" />
          إلغاء
        </button>
      }
    </ng-template>
  `,
  styleUrl: './driver-account.shared.scss',
})
export class DriverPaymentsComponent {
  private readonly api = inject(DriverLedgerApi);
  private readonly auth = inject(AuthService);

  readonly driverId = input.required<string>();
  /** Bumped by the parent after any ledger action → reload. */
  readonly version = input(0);
  /** A payment was voided (the parent refreshes balance + statement + charges). */
  readonly changed = output<void>();

  protected readonly METHOD = PAYMENT_METHOD;
  protected readonly pageSize = 10;

  protected readonly url = injectUrlState<{ payVoided: boolean; payPage: number }>({
    payVoided: false,
    payPage: 1,
  });
  protected readonly state = this.url.state;

  protected readonly payments = createResource(
    () => ({ id: this.driverId(), s: this.state(), v: this.version() }),
    ({ id, s }) =>
      this.api.payments(id, {
        includeVoided: s.payVoided,
        pageIndex: s.payPage,
        pageSize: this.pageSize,
      }),
    { refetchOn: inject(DashboardHubService).reconnected$ },
  );
  protected readonly rows = computed(() => this.payments.value()?.data ?? []);

  private readonly canManage = computed(() =>
    this.auth.hasPermission(PERMISSIONS.DriverPayments.Manage),
  );

  private readonly dateTpl = viewChild<Row>('dateTpl');
  private readonly amountTpl = viewChild<Row>('amountTpl');
  private readonly methodTpl = viewChild<Row>('methodTpl');
  private readonly refTpl = viewChild<Row>('refTpl');
  private readonly byTpl = viewChild<Row>('byTpl');
  private readonly stateTpl = viewChild<Row>('stateTpl');
  private readonly actionsTpl = viewChild<Row>('actionsTpl');

  protected readonly columns = computed<TableColumn<DriverPaymentDto>[]>(() => [
    { key: 'paidAtUtc', label: 'تاريخ الدفع', cellTemplate: this.dateTpl() },
    { key: 'amount', label: 'المبلغ', align: 'end', cellTemplate: this.amountTpl() },
    { key: 'method', label: 'الطريقة', cellTemplate: this.methodTpl() },
    { key: 'reference', label: 'المرجع / ملاحظات', cellTemplate: this.refTpl() },
    { key: 'recordedByName', label: 'سجّلها', cellTemplate: this.byTpl() },
    { key: 'isVoided', label: 'الحالة', cellTemplate: this.stateTpl() },
    ...(this.canManage()
      ? [{ key: 'actions', label: '', align: 'end' as const, cellTemplate: this.actionsTpl() }]
      : []),
  ]);

  // ── void ──
  protected readonly voiding = signal<DriverPaymentDto | null>(null);
  protected readonly voidMessage = computed(() => {
    const p = this.voiding();
    return p ? `دفعة بمبلغ ${formatMoney(p.amount)} بتاريخ ${formatCairo(p.paidAtUtc)}.` : '';
  });
  protected readonly voidConfirm = computed<ConfirmDialogConfig | null>(() => {
    const p = this.voiding();
    if (!p) return null;
    return {
      title: 'تأكيد إلغاء الدفعة',
      message:
        `ستُلغى دفعة بمبلغ ${formatMoney(p.amount)}، وتعود المديونيات التي سددتها ` +
        'غير مسددة (أو يُخصم من الرصيد الدائن). لا يمكن التراجع عن الإلغاء.',
      type: 'danger',
      confirmText: `إلغاء ${formatMoney(p.amount)}`,
    };
  });
  protected readonly voidAction = (reason: string) =>
    this.api.voidPayment(this.voiding()?.id ?? '', { reason });

  protected toggleVoided(event: Event): void {
    this.url.patch({ payVoided: (event.target as HTMLInputElement).checked, payPage: 1 });
  }

  protected onVoided(): void {
    this.voiding.set(null);
    this.changed.emit();
  }
}
