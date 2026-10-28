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
import { DialogService } from '@core/services/dialog.service';
import { ToastService } from '@core/services/toast.service';
import { ApiError } from '@core/models/api-response.model';
import { RentalDto } from '@core/models/domain.models';
import { RENT_PERIOD, RentPeriod, enumLabel, enumOptions } from '@core/constants/enums';
import { formatMoney } from '@core/utils/format.util';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { RentalsApi } from '../../data-access/rentals.api';
import { UpdateRentalTermsRequest } from '../../models/rental.models';

/** `PUT /rentals/{id}/terms` — amounts, period, contract number, terms. */
@Component({
  selector: 'app-rental-terms-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, FormErrorComponent],
  templateUrl: './rental-terms-dialog.component.html',
})
export class RentalTermsDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(RentalsApi);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly rental = input.required<RentalDto | null>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly periodOptions = enumOptions(RENT_PERIOD);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    contractNumber: ['', Validators.maxLength(50)],
    rentAmount: [0, [Validators.required, Validators.min(0.01)]],
    rentPeriod: ['Daily' as RentPeriod, Validators.required],
    depositAmount: [0, [Validators.required, Validators.min(0)]],
    terms: [''],
    notes: [''],
  });

  constructor() {
    effect(() => {
      const r = this.rental();
      if (!this.open() || !r) return;
      untracked(() =>
        this.form.reset({
          contractNumber: r.contractNumber ?? '',
          rentAmount: r.rentAmount ?? 0,
          rentPeriod: r.rentPeriod ?? 'Daily',
          depositAmount: r.depositAmount ?? 0,
          terms: r.terms ?? '',
          notes: r.notes ?? '',
        }),
      );
    });
  }

  protected async submit(): Promise<void> {
    const r = this.rental();
    if (!r) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const rent = Number(v.rentAmount);
    const deposit = Number(v.depositAmount);

    // Money changes are confirmed with before → after amounts.
    const changes: string[] = [];
    if (rent !== r.rentAmount || v.rentPeriod !== r.rentPeriod) {
      changes.push(
        `الإيجار من ${formatMoney(r.rentAmount)} (${enumLabel(RENT_PERIOD, r.rentPeriod)}) ` +
          `إلى ${formatMoney(rent)} (${enumLabel(RENT_PERIOD, v.rentPeriod)})`,
      );
    }
    if (deposit !== r.depositAmount) {
      changes.push(`التأمين من ${formatMoney(r.depositAmount)} إلى ${formatMoney(deposit)}`);
    }
    if (changes.length) {
      const ok = await this.dialog.confirm({
        title: 'تأكيد تعديل القيمة المالية',
        message: `سيتم تعديل ${changes.join('، و')} لإيجار ${r.plateNumber ?? ''}.`,
        type: 'warning',
        confirmText: 'حفظ التعديل',
      });
      if (!ok) return;
    }

    const body: UpdateRentalTermsRequest = {
      contractNumber: v.contractNumber.trim() || null,
      rentAmount: rent,
      rentPeriod: v.rentPeriod,
      depositAmount: deposit,
      terms: v.terms.trim() || null,
      notes: v.notes.trim() || null,
    };
    this.saving.set(true);
    this.api.updateTerms(r.id, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('تم حفظ شروط الإيجار');
        this.saved.emit();
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        applyServerErrors(this.form, err, this.toast);
      },
    });
  }
}
