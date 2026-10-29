import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { LookupService } from '@core/data/lookup.service';
import { ApiError } from '@core/models/api-response.model';
import { MotorcycleDto } from '@core/models/domain.models';
import { DialogService } from '@core/services/dialog.service';
import { ToastService } from '@core/services/toast.service';
import { formatMoney } from '@core/utils/format.util';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import {
  PickerOption,
  RemotePickerComponent,
} from '@shared/components/remote-picker/remote-picker.component';
import { DriverLedgerApi } from '../../data-access/driver-ledger.api';

/**
 * Add a manual debt on a driver (damage, fines outside the system…). Repair
 * invoices and oil fines arrive automatically — this is for everything else.
 */
@Component({
  selector: 'app-manual-charge-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, FormErrorComponent, RemotePickerComponent],
  template: `
    <app-modal [open]="open()" title="إضافة مديونية يدوية" size="md" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="form-grid">
          <div>
            <label class="form-label" for="mc-amount">المبلغ (ج.م) *</label>
            <input
              id="mc-amount"
              type="number"
              class="form-control ltr"
              formControlName="amount"
              min="0.01"
              step="0.01"
              inputmode="decimal"
            />
            <app-form-error [control]="form.controls.amount" label="المبلغ" />
          </div>
          <div>
            <label class="form-label" for="mc-moto">الموتوسيكل (اختياري)</label>
            <app-remote-picker
              inputId="mc-moto"
              formControlName="motorcycleId"
              icon="bike"
              placeholder="بدون موتوسيكل"
              searchPlaceholder="ابحث برقم اللوحة أو الماركة…"
              [search]="searchMotorcycles"
              (picked)="plate.set($event?.label ?? null)"
            />
            <app-form-error [control]="form.controls.motorcycleId" label="الموتوسيكل" />
          </div>
          <div class="span-2">
            <label class="form-label" for="mc-desc">الوصف *</label>
            <textarea
              id="mc-desc"
              class="form-control"
              rows="3"
              formControlName="description"
              placeholder="سبب المديونية — يظهر للسائق وفي كشف الحساب"
            ></textarea>
            <app-form-error [control]="form.controls.description" label="الوصف" />
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn" (click)="closed.emit()">إلغاء</button>
          <button type="submit" class="btn btn-re" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            }
            إضافة المديونية
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class ManualChargeDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(DriverLedgerApi);
  private readonly lookups = inject(LookupService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly driverId = input.required<string>();
  readonly driverName = input<string | null>(null);
  readonly closed = output<void>();
  readonly added = output<void>();

  protected readonly saving = signal(false);
  protected readonly plate = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    motorcycleId: [null as string | null],
  });

  protected readonly searchMotorcycles = (term: string) =>
    this.lookups.motorcycles(term).pipe(
      map((rows) =>
        rows.map((m): PickerOption<MotorcycleDto> => ({
          value: m.id,
          label: m.plateNumber,
          hint: [m.brand, m.model, m.officeName].filter(Boolean).join(' · '),
          data: m,
        })),
      ),
    );

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.saving.set(false);
        this.plate.set(null);
        this.form.reset();
      });
    });
  }

  protected async submit(): Promise<void> {
    const description = this.form.controls.description;
    description.setValue(description.value.trim());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const amount = Math.round((v.amount ?? 0) * 100) / 100;
    const plate = v.motorcycleId && this.plate() ? ` (موتوسيكل ${this.plate()})` : '';
    const ok = await this.dialog.confirm({
      title: 'تأكيد إضافة مديونية',
      message:
        `سيُضاف على ${this.driverName() || 'السائق'} دين بمبلغ ${formatMoney(amount)}${plate}: ` +
        `«${v.description}». ستظهر في كشف حسابه ومديونياته.`,
      type: 'warning',
      confirmText: `إضافة ${formatMoney(amount)}`,
    });
    if (!ok) return;

    this.saving.set(true);
    this.api
      .addManualCharge(this.driverId(), {
        amount,
        description: v.description,
        motorcycleId: v.motorcycleId || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success('تمت إضافة المديونية');
          this.added.emit();
        },
        error: (err: ApiError) => {
          this.saving.set(false);
          applyServerErrors(this.form, err, this.toast);
        },
      });
  }
}
