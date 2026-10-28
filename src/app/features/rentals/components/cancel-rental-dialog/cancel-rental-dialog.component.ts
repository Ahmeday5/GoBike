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
import { formatMoney } from '@core/utils/format.util';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CairoDatePipe } from '@shared/pipes/format.pipes';
import { applyServerErrors } from '@shared/forms/server-errors';
import { RentalsApi } from '../../data-access/rentals.api';

/**
 * Cancel a rental (allowed only inside the cancel window — otherwise the API
 * answers 422 and its message is shown as a toast).
 */
@Component({
  selector: 'app-cancel-rental-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, FormErrorComponent, IconComponent, CairoDatePipe],
  template: `
    <app-modal [open]="open()" title="إلغاء الإيجار" titleColorClass="text-danger" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <p class="cr-text">
          الإلغاء يعني أن الإيجار لم يتم فعليًا (خطأ في التسجيل مثلًا)، وتعود الموتوسيكل
          <strong class="ltr">{{ rental()?.plateNumber }}</strong> متاحة. لتسليم موتوسيكل عادت من
          السائق استخدم «استلام» بدلًا من ذلك.
        </p>
        @if (rental()?.cancellableUntilUtc) {
          <p class="cr-window">
            <app-icon name="clock" [size]="14" />
            متاح الإلغاء حتى {{ rental()?.cancellableUntilUtc | cairoDate }}
          </p>
        }
        <label class="form-label" for="cr-reason">سبب الإلغاء *</label>
        <textarea
          id="cr-reason"
          class="form-control"
          rows="3"
          formControlName="reason"
          placeholder="اذكر سبب الإلغاء"
        ></textarea>
        <app-form-error [control]="form.controls.reason" label="سبب الإلغاء" />

        <div class="modal-actions">
          <button type="button" class="btn" (click)="closed.emit()">رجوع</button>
          <button type="submit" class="btn btn-re" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            }
            إلغاء الإيجار
          </button>
        </div>
      </form>
    </app-modal>
  `,
  styles: `
    .cr-text {
      margin: 0 0 0.75rem;
      font-size: var(--fs-sm);
      line-height: 1.8;
      color: var(--txt2);
    }
    .cr-window {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      margin: 0 0 0.75rem;
      padding: 0.375rem 0.625rem;
      border-radius: var(--r);
      background: var(--am-l);
      color: var(--am);
      font-size: var(--fs-xs);
      font-weight: 600;
    }
  `,
})
export class CancelRentalDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(RentalsApi);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly rental = input.required<RentalDto | null>();
  readonly closed = output<void>();
  readonly cancelled = output<void>();

  protected readonly saving = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.maxLength(500)]],
  });

  constructor() {
    effect(() => {
      if (this.open()) untracked(() => this.form.reset());
    });
  }

  protected async submit(): Promise<void> {
    const r = this.rental();
    if (!r) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const ok = await this.dialog.confirm({
      title: 'تأكيد إلغاء الإيجار',
      message:
        `سيتم إلغاء إيجار ${r.plateNumber ?? ''} للسائق ${r.driverName ?? ''} ` +
        `(إيجار ${formatMoney(r.rentAmount)}، تأمين ${formatMoney(r.depositAmount)}) ` +
        'وتعود الموتوسيكل متاحة. لا يمكن التراجع عن الإلغاء.',
      type: 'danger',
      confirmText: 'نعم، إلغاء الإيجار',
    });
    if (!ok) return;

    this.saving.set(true);
    this.api.cancel(r.id, { reason: this.form.controls.reason.value.trim() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('تم إلغاء الإيجار');
        this.cancelled.emit();
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        applyServerErrors(this.form, err, this.toast);
      },
    });
  }
}
