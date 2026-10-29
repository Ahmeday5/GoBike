import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { map, startWith } from 'rxjs';
import { AuthService } from '@core/auth/services/auth.service';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { APP_ROUTES } from '@core/constants/app-routes';
import {
  REPAIR_INVOICE_PAYER,
  REPAIR_INVOICE_STATUS,
  RepairInvoicePayer,
} from '@core/constants/enums';
import { createResource } from '@core/data/resource';
import { LookupService } from '@core/data/lookup.service';
import { ApiError } from '@core/models/api-response.model';
import { DriverDto } from '@core/models/domain.models';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { DialogService } from '@core/services/dialog.service';
import { ToastService } from '@core/services/toast.service';
import { formatMoney } from '@core/utils/format.util';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ChipComponent, EnumChipComponent } from '@shared/components/chip/chip.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { FORMAT_PIPES } from '@shared/pipes/format.pipes';
import {
  PickerOption,
  RemotePickerComponent,
} from '@shared/components/remote-picker/remote-picker.component';
import { RepairInvoicesApi } from '../../data-access/repair-invoices.api';
import { DecideRepairInvoiceRequest, normalizeLines } from '../../models/repair-invoice.models';

/** 5.11 — One repair invoice: lines, links, and the "who pays" decision. */
@Component({
  selector: 'app-repair-invoice-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    PageHeaderComponent,
    ChipComponent,
    EnumChipComponent,
    EmptyStateComponent,
    FormErrorComponent,
    IconComponent,
    RemotePickerComponent,
    ...FORMAT_PIPES,
  ],
  templateUrl: './repair-invoice-detail.component.html',
  styleUrl: './repair-invoice-detail.component.scss',
})
export class RepairInvoiceDetailComponent {
  private readonly api = inject(RepairInvoicesApi);
  private readonly auth = inject(AuthService);
  private readonly lookups = inject(LookupService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  /** Route param (component input binding). */
  readonly id = input.required<string>();

  protected readonly ROUTES = APP_ROUTES;
  protected readonly STATUS = REPAIR_INVOICE_STATUS;
  protected readonly PAYER = REPAIR_INVOICE_PAYER;

  protected readonly invoiceRes = createResource(
    () => this.id() || null,
    (id) => this.api.get(id),
    { refetchOn: inject(DashboardHubService).reconnected$ },
  );
  protected readonly invoice = computed(() => this.invoiceRes.value() ?? null);
  protected readonly notFound = computed(() => {
    const s = this.invoiceRes.error()?.status;
    return s === 404 || s === 403;
  });
  protected readonly lines = computed(() => normalizeLines(this.invoice()?.lines));
  protected readonly linesTotal = computed(() =>
    this.lines().reduce((sum, l) => sum + (l.total ?? 0), 0),
  );

  protected readonly isPending = computed(() => this.invoice()?.status === 'PendingDecision');
  protected readonly canDecide = computed(
    () => this.isPending() && this.auth.hasPermission(PERMISSIONS.RepairInvoices.Decide),
  );

  /** The driver the invoice was charged to (decided state). */
  protected readonly chargedDriver = computed(() => {
    const i = this.invoice();
    if (!i) return null;
    const charged = i.status === 'ChargedToDriver' || i.paidBy === 'Driver';
    if (!charged) return null;
    const id = i.chargedDriverId ?? i.suggestedDriverId ?? null;
    const name = i.chargedDriverName ?? (i.chargedDriverId ? null : i.suggestedDriverName) ?? null;
    return id ? { id, name } : null;
  });

  // ── decision form ──
  protected readonly saving = signal(false);
  protected readonly driverOption = signal<PickerOption | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    paidBy: ['' as RepairInvoicePayer | '', Validators.required],
    driverId: [''],
    notes: ['', Validators.maxLength(1000)],
  });
  private readonly values = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.form.getRawValue()),
    ),
    { initialValue: this.form.getRawValue() },
  );
  protected readonly paidBy = computed(() => this.values().paidBy);
  protected readonly submitted = signal(false);

  protected readonly suggestedOption = computed<PickerOption | null>(() => {
    const i = this.invoice();
    return i?.suggestedDriverId
      ? { value: i.suggestedDriverId, label: i.suggestedDriverName ?? '…', hint: 'السائق المقترح' }
      : null;
  });

  /** Any driver (not only active ones) can carry a debt. */
  protected readonly searchDrivers = (term: string) =>
    this.lookups.drivers(term, false).pipe(
      map((rows) =>
        rows.map((d): PickerOption<DriverDto> => ({
          value: d.id,
          label: d.fullName,
          hint: d.phoneNumber,
          data: d,
        })),
      ),
    );

  constructor() {
    // Reset the decision form when another invoice loads (not on background refetches).
    let lastId: string | null = null;
    effect(() => {
      const i = this.invoice();
      untracked(() => {
        if (!i || i.id === lastId) return;
        lastId = i.id;
        this.submitted.set(false);
        this.form.reset({ paidBy: '', driverId: i.suggestedDriverId ?? '', notes: '' });
        this.driverOption.set(this.suggestedOption());
      });
    });
  }

  protected setPaidBy(payer: RepairInvoicePayer): void {
    this.form.controls.paidBy.setValue(payer);
    const driver = this.form.controls.driverId;
    if (payer === 'Driver') driver.setValidators(Validators.required);
    else driver.clearValidators();
    driver.updateValueAndValidity();
  }

  protected onDriverPicked(o: PickerOption | null): void {
    this.driverOption.set(o);
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    const i = this.invoice();
    if (!i) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const payer = v.paidBy as RepairInvoicePayer;
    const amount = formatMoney(i.amount);
    const ref = i.externalInvoiceNumber ? ` رقم ${i.externalInvoiceNumber}` : '';
    const driverName =
      this.driverOption()?.value === v.driverId ? this.driverOption()?.label : null;

    const ok = await this.dialog.confirm(
      payer === 'Driver'
        ? {
            title: 'تحميل الفاتورة على السائق',
            message:
              `سيُسجَّل مبلغ ${amount} (فاتورة الإصلاح${ref}) مديونيةً على السائق ` +
              `${driverName ?? 'المختار'} وتظهر في حسابه. لا يمكن تغيير القرار بعد التأكيد.`,
            type: 'warning',
            confirmText: `تسجيل ${amount} على السائق`,
          }
        : {
            title: 'تحميل الفاتورة على الشركة',
            message:
              `سيُسجَّل مبلغ ${amount} (فاتورة الإصلاح${ref}) كمصروف على الشركة، ` +
              'ولن يُحمَّل على أي سائق. لا يمكن تغيير القرار بعد التأكيد.',
            type: 'warning',
            confirmText: 'تسجيل كمصروف على الشركة',
          },
    );
    if (!ok) return;

    const body: DecideRepairInvoiceRequest = {
      paidBy: payer,
      driverId: payer === 'Driver' ? v.driverId : null,
      notes: v.notes.trim() || null,
    };
    this.saving.set(true);
    this.api.decide(i.id, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(
          payer === 'Driver'
            ? `تم تسجيل ${amount} مديونيةً على السائق`
            : `تم تسجيل ${amount} كمصروف على الشركة`,
        );
        this.invoiceRes.reload();
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        applyServerErrors(this.form, err, this.toast);
      },
    });
  }
}
