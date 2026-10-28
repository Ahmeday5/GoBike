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
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DRIVER_STATUS, DriverStatus, enumOptions } from '@core/constants/enums';
import { DriverDto } from '@core/models/domain.models';
import { ApiError } from '@core/models/api-response.model';
import { ToastService } from '@core/services/toast.service';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { DriversApi } from '../../data-access/drivers.api';

/** `POST /drivers/{id}/status`. A reason is required for anything but Active. */
@Component({
  selector: 'app-driver-status-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, FormErrorComponent, IconComponent],
  template: `
    <app-modal [open]="open()" title="تغيير حالة السائق" size="md" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="form-grid">
          <div class="span-2">
            <label class="form-label" for="ds-status">الحالة الجديدة *</label>
            <select id="ds-status" class="form-select" formControlName="status">
              @for (o of options; track o.value) {
                <option [value]="o.value">{{ o.label }}</option>
              }
            </select>
          </div>
          @if (status() !== 'Active') {
            <div class="span-2 anim-fade-up">
              <label class="form-label" for="ds-reason">السبب *</label>
              <textarea
                id="ds-reason"
                class="form-control"
                rows="3"
                formControlName="reason"
                placeholder="يظهر بجوار حالة السائق في الملف والقائمة"
              ></textarea>
              <app-form-error [control]="form.controls.reason" label="السبب" />
              <p class="form-hint">
                <app-icon name="lock" [size]="12" />
                السائق غير النشط لا يستطيع الدخول إلى التطبيق.
              </p>
            </div>
          } @else {
            <p class="form-hint span-2">سيُمسح سبب الإيقاف السابق عند إعادة التفعيل.</p>
          }
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" (click)="closed.emit()">إلغاء</button>
          <button
            type="submit"
            class="btn"
            [class.btn-brand]="status() === 'Active'"
            [class.btn-re]="status() !== 'Active'"
            [disabled]="saving()"
          >
            @if (saving()) {
              <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            }
            حفظ الحالة
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class DriverStatusDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(DriversApi);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly driver = input<DriverDto | null>(null);
  readonly closed = output<void>();
  readonly saved = output<DriverDto>();

  protected readonly options = enumOptions(DRIVER_STATUS);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    status: ['Active' as DriverStatus, Validators.required],
    reason: [''],
  });
  protected readonly status = toSignal(this.form.controls.status.valueChanges, {
    initialValue: 'Active' as DriverStatus,
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const d = this.driver();
      untracked(() => {
        // Preselect the most likely change: suspend an active driver, reactivate otherwise.
        const next: DriverStatus = d?.status === 'Active' ? 'Suspended' : 'Active';
        this.form.reset({ status: next, reason: '' });
      });
    });

    // Reason is mandatory only when leaving Active.
    this.form.controls.status.valueChanges.subscribe((s) => {
      const reason = this.form.controls.reason;
      reason.setValidators(s === 'Active' ? null : [Validators.required, Validators.maxLength(500)]);
      reason.updateValueAndValidity({ emitEvent: false });
    });
  }

  protected submit(): void {
    const d = this.driver();
    if (!d) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { status, reason } = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .changeStatus(d.id, { status, reason: status === 'Active' ? null : reason.trim() })
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.toast.success('تم تغيير حالة السائق');
          this.saved.emit(updated);
        },
        error: (err: ApiError) => {
          this.saving.set(false);
          applyServerErrors(this.form, err, this.toast);
        },
      });
  }
}
