import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  DRIVER_CHARGE_SOURCE,
  PAYMENT_METHOD,
  PaymentMethod,
  enumOptions,
} from '@core/constants/enums';
import { ApiError } from '@core/models/api-response.model';
import { DialogService } from '@core/services/dialog.service';
import { ToastService } from '@core/services/toast.service';
import { cairoInputToUtc, cairoNowInput } from '@core/utils/cairo-time.util';
import { formatMoney } from '@core/utils/format.util';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { MoneyPipe } from '@shared/pipes/format.pipes';
import { applyServerErrors } from '@shared/forms/server-errors';
import { DriverLedgerApi } from '../../data-access/driver-ledger.api';
import { PaymentOutcome } from '../../models/ledger.models';
import { toPaymentOutcome } from './ledger.util';

/**
 * Record a driver payment. The backend settles the oldest debts first and
 * keeps any excess as credit, so after a successful save the dialog switches
 * to a summary of where the money went instead of closing.
 */
@Component({
  selector: 'app-record-payment-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    ModalComponent,
    FormErrorComponent,
    EnumChipComponent,
    IconComponent,
    MoneyPipe,
  ],
  template: `
    <app-modal
      [open]="open()"
      [title]="outcome() ? 'تم تسجيل الدفعة' : 'تسجيل دفعة'"
      size="md"
      (closed)="closed.emit()"
    >
      @if (outcome(); as o) {
        <div class="rp-done">
          <p class="rp-done__lead">
            <app-icon name="check-circle" [size]="20" />
            <span>
              سُجِّلت دفعة بمبلغ <strong class="amount">{{ o.amount | money }}</strong>
              @if (driverName()) {
                من {{ driverName() }}
              }
            </span>
          </p>

          @if (o.allocations.length) {
            <h3 class="rp-done__title">سُدِّدت بها المديونيات التالية (الأقدم أولًا)</h3>
            <ul class="rp-alloc">
              @for (a of o.allocations; track $index) {
                <li class="rp-alloc__row">
                  <div class="rp-alloc__what">
                    @if (a.source) {
                      <app-enum-chip [map]="SOURCE" [value]="a.source" [small]="true" />
                    }
                    <span>{{ a.chargeDescription || a.description || 'مديونية' }}</span>
                  </div>
                  <div class="rp-alloc__nums">
                    <span class="amount amount--credit">{{ a.amount | money }}</span>
                    @if (
                      a.chargeRemainingAmount !== null && a.chargeRemainingAmount !== undefined
                    ) {
                      <span class="muted">
                        {{
                          a.chargeRemainingAmount > 0
                            ? 'متبقٍ ' + (a.chargeRemainingAmount | money)
                            : 'سُدِّدت بالكامل'
                        }}
                      </span>
                    }
                  </div>
                </li>
              }
            </ul>
          } @else if (o.unallocated !== null) {
            <p class="muted">لم تكن على السائق مديونيات مفتوحة.</p>
          }

          @if (o.unallocated) {
            <p class="rp-done__credit">
              <app-icon name="info" [size]="14" />
              <span>
                <strong class="amount">{{ o.unallocated | money }}</strong>
                زيادة لم تُخصَّص لأي مديونية وأُضيفت رصيدًا دائنًا للسائق.
              </span>
            </p>
          }
          @if (o.creditAfter) {
            <p class="muted rp-done__after">
              الرصيد الدائن للسائق الآن: <span class="amount">{{ o.creditAfter | money }}</span>
            </p>
          }
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-brand" (click)="closed.emit()">تم</button>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (outstanding() > 0) {
            <p class="rp-hint">
              المديونية الحالية:
              <strong class="amount amount--debt">{{ outstanding() | money }}</strong>
              — تُسدَّد الأقدم أولًا، وأي زيادة تُحفظ رصيدًا دائنًا.
            </p>
          } @else {
            <p class="rp-hint">لا توجد مديونية حالية؛ ستُحفظ الدفعة رصيدًا دائنًا للسائق.</p>
          }
          <div class="form-grid">
            <div>
              <label class="form-label" for="rp-amount">المبلغ (ج.م) *</label>
              <input
                id="rp-amount"
                type="number"
                class="form-control ltr"
                formControlName="amount"
                min="0.01"
                step="0.01"
                inputmode="decimal"
              />
              <app-form-error [control]="form.controls.amount" label="المبلغ" />
              @if (outstanding() > 0) {
                <button type="button" class="link-btn rp-fill" (click)="fillOutstanding()">
                  سداد كامل المديونية ({{ outstanding() | money }})
                </button>
              }
            </div>
            <div>
              <label class="form-label" for="rp-method">طريقة الدفع *</label>
              <select id="rp-method" class="form-select" formControlName="method">
                @for (m of methods; track m.value) {
                  <option [value]="m.value">{{ m.label }}</option>
                }
              </select>
              <app-form-error [control]="form.controls.method" label="طريقة الدفع" />
            </div>
            <div>
              <label class="form-label" for="rp-at">تاريخ الدفع</label>
              <input
                id="rp-at"
                type="datetime-local"
                class="form-control"
                formControlName="paidAt"
              />
              <div class="form-hint">بتوقيت القاهرة. اتركه للوقت الحالي.</div>
              <app-form-error [control]="form.controls.paidAt" label="تاريخ الدفع" />
            </div>
            <div>
              <label class="form-label" for="rp-ref">المرجع</label>
              <input
                id="rp-ref"
                class="form-control"
                formControlName="reference"
                placeholder="رقم الإيصال أو التحويل"
              />
              <app-form-error [control]="form.controls.reference" label="المرجع" />
            </div>
            <div class="span-2">
              <label class="form-label" for="rp-notes">ملاحظات</label>
              <textarea
                id="rp-notes"
                class="form-control"
                rows="2"
                formControlName="notes"
              ></textarea>
              <app-form-error [control]="form.controls.notes" label="الملاحظات" />
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn" (click)="closed.emit()">إلغاء</button>
            <button type="submit" class="btn btn-brand" [disabled]="saving()">
              @if (saving()) {
                <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
              }
              تسجيل الدفعة
            </button>
          </div>
        </form>
      }
    </app-modal>
  `,
  styles: `
    .rp-hint {
      margin: 0 0 0.875rem;
      padding: 0.5rem 0.75rem;
      border-radius: var(--r);
      background: var(--bg3);
      font-size: var(--fs-sm);
      color: var(--txt2);
    }
    .rp-fill {
      margin-top: 0.25rem;
      font-size: var(--fs-xs);
    }
    .rp-done {
      display: grid;
      gap: 0.75rem;
    }
    .rp-done__lead {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      font-size: var(--fs-md);
      app-icon {
        color: var(--gr);
      }
    }
    .rp-done__title {
      margin: 0;
      font-size: var(--fs-sm);
      font-weight: 700;
      color: var(--txt2);
    }
    .rp-alloc {
      display: grid;
      gap: 0.375rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .rp-alloc__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--brd);
      border-radius: var(--r);
      font-size: var(--fs-sm);
    }
    .rp-alloc__what {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.375rem;
      min-width: 0;
    }
    .rp-alloc__nums {
      display: grid;
      justify-items: end;
      flex-shrink: 0;
      font-size: var(--fs-xs);
    }
    .rp-done__credit {
      display: flex;
      align-items: flex-start;
      gap: 0.375rem;
      margin: 0;
      padding: 0.5rem 0.75rem;
      border-radius: var(--r);
      background: var(--gr-l);
      color: var(--gr);
      font-size: var(--fs-sm);
    }
    .rp-done__after {
      margin: 0;
      font-size: var(--fs-sm);
    }
  `,
})
export class RecordPaymentDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(DriverLedgerApi);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly driverId = input.required<string>();
  readonly driverName = input<string | null>(null);
  /** Current debt — stated in the form and offered as a one-click amount. */
  readonly outstanding = input(0);
  readonly closed = output<void>();
  /** Emitted as soon as the payment is saved (the dialog stays open on the summary). */
  readonly recorded = output<void>();

  protected readonly SOURCE = DRIVER_CHARGE_SOURCE;
  protected readonly methods = enumOptions(PAYMENT_METHOD);
  protected readonly saving = signal(false);
  protected readonly outcome = signal<PaymentOutcome | null>(null);
  private readonly who = computed(() => this.driverName() || 'السائق');

  protected readonly form = this.fb.nonNullable.group({
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    method: ['Cash' as PaymentMethod, Validators.required],
    paidAt: [''],
    reference: ['', Validators.maxLength(100)],
    notes: ['', Validators.maxLength(500)],
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.outcome.set(null);
        this.saving.set(false);
        this.form.reset({ amount: null, method: 'Cash', paidAt: cairoNowInput() });
      });
    });
  }

  protected fillOutstanding(): void {
    this.form.controls.amount.setValue(this.outstanding());
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const amount = Math.round((v.amount ?? 0) * 100) / 100;
    const paidAtUtc = cairoInputToUtc(v.paidAt);
    if (paidAtUtc && Date.parse(paidAtUtc) > Date.now() + 60_000) {
      const at = this.form.controls.paidAt;
      at.setErrors({ server: 'لا يمكن أن يكون تاريخ الدفع في المستقبل' });
      at.markAsTouched();
      return;
    }

    const outstanding = this.outstanding();
    const impact =
      outstanding <= 0
        ? 'لا توجد مديونية حالية، فسيُحفظ المبلغ كله رصيدًا دائنًا.'
        : amount > outstanding
          ? `ستُسدَّد المديونية كلها (${formatMoney(outstanding)}) ويُحفظ ${formatMoney(amount - outstanding)} رصيدًا دائنًا.`
          : 'يُخصم المبلغ من أقدم المديونيات أولًا.';
    const ok = await this.dialog.confirm({
      title: 'تأكيد تسجيل الدفعة',
      message: `سيتم تسجيل دفعة بمبلغ ${formatMoney(amount)} من ${this.who()}. ${impact}`,
      type: 'info',
      confirmText: `تسجيل ${formatMoney(amount)}`,
    });
    if (!ok) return;

    this.saving.set(true);
    this.api
      .recordPayment(this.driverId(), {
        amount,
        method: v.method,
        paidAtUtc,
        reference: v.reference.trim() || null,
        notes: v.notes.trim() || null,
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.toast.success('تم تسجيل الدفعة');
          this.outcome.set(toPaymentOutcome(res, amount));
          this.recorded.emit();
        },
        error: (err: ApiError) => {
          this.saving.set(false);
          applyServerErrors(this.form, err, this.toast);
        },
      });
  }
}
