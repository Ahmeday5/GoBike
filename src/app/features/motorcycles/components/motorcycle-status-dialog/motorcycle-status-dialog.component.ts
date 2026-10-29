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
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MOTORCYCLE_STATUS, MotorcycleStatus, enumLabel } from '@core/constants/enums';
import { MotorcycleDto } from '@core/models/domain.models';
import { ApiError } from '@core/models/api-response.model';
import { ToastService } from '@core/services/toast.service';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EnumChipComponent } from '@shared/components/chip/chip.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { MotorcyclesApi } from '../../data-access/motorcycles.api';

/**
 * `POST /motorcycles/{id}/status`. Only the transitions the API lists in
 * `allowedStatusChanges` are offered; business refusals (e.g. back to
 * Available while a repair is open → 422) come back as the API's message.
 */
@Component({
  selector: 'app-motorcycle-status-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    ModalComponent,
    FormErrorComponent,
    IconComponent,
    EnumChipComponent,
  ],
  template: `
    <app-modal [open]="open()" title="تغيير حالة الموتوسيكل" size="md" (closed)="closed.emit()">
      @if (options().length === 0) {
        <p class="ms-text">
          <app-icon name="info" [size]="16" />
          لا يمكن تغيير حالة هذا الموتوسيكل يدويًا الآن (الحالة الحالية:
          {{ currentLabel() }}). تتغير الحالة تلقائيًا مع الإيجار والاستلام والصيانة.
        </p>
        <div class="modal-actions">
          <button type="button" class="btn" (click)="closed.emit()">إغلاق</button>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="form-grid">
            <div class="span-2 ms-current">
              <span class="muted">الحالة الحالية:</span>
              <app-enum-chip [map]="STATUS" [value]="motorcycle()?.status" [small]="true" />
            </div>
            <div class="span-2">
              <label class="form-label" for="ms-status">الحالة الجديدة *</label>
              <select id="ms-status" class="form-select" formControlName="status">
                @for (o of options(); track o.value) {
                  <option [value]="o.value">{{ o.label }}</option>
                }
              </select>
              <app-form-error [control]="form.controls.status" label="الحالة" />
            </div>
            <div class="span-2">
              <label class="form-label" for="ms-reason">
                السبب{{ reasonRequired() ? ' *' : '' }}
              </label>
              <textarea
                id="ms-reason"
                class="form-control"
                rows="3"
                formControlName="reason"
                placeholder="يُسجَّل في سجل الحالات"
              ></textarea>
              <app-form-error [control]="form.controls.reason" label="السبب" />
              @if (status() === 'Available') {
                <p class="form-hint">
                  <app-icon name="info" [size]="12" />
                  لا يمكن الإرجاع إلى «متاحة» طالما توجد صيانة مفتوحة لم يعتمدها المشرف.
                </p>
              }
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn" (click)="closed.emit()">إلغاء</button>
            <button type="submit" class="btn btn-brand" [disabled]="saving()">
              @if (saving()) {
                <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
              }
              حفظ الحالة
            </button>
          </div>
        </form>
      }
    </app-modal>
  `,
  styles: `
    .ms-text {
      display: flex;
      gap: 0.5rem;
      margin: 0;
      font-size: var(--fs-sm);
      line-height: 1.8;
      color: var(--txt2);
    }
    .ms-current {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: var(--fs-sm);
    }
  `,
})
export class MotorcycleStatusDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(MotorcyclesApi);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly motorcycle = input<MotorcycleDto | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly STATUS = MOTORCYCLE_STATUS;
  protected readonly saving = signal(false);

  protected readonly options = computed(() =>
    (this.motorcycle()?.allowedStatusChanges ?? []).map((value) => ({
      value,
      label: enumLabel(MOTORCYCLE_STATUS, value),
    })),
  );
  protected readonly currentLabel = computed(() =>
    enumLabel(MOTORCYCLE_STATUS, this.motorcycle()?.status),
  );

  protected readonly form = this.fb.nonNullable.group({
    status: ['' as MotorcycleStatus | '', Validators.required],
    reason: [''],
  });
  protected readonly status = toSignal(this.form.controls.status.valueChanges, {
    initialValue: '' as MotorcycleStatus | '',
  });
  /** A reason is required whenever the bike is taken out of service. */
  protected readonly reasonRequired = computed(() => {
    const s = this.status();
    return !!s && s !== 'Available';
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const first = this.options()[0]?.value ?? '';
      untracked(() => {
        this.form.reset({ status: first, reason: '' });
        this.saving.set(false);
      });
    });

    this.form.controls.status.valueChanges.subscribe((s) => {
      const reason = this.form.controls.reason;
      reason.setValidators(
        s && s !== 'Available'
          ? [Validators.required, Validators.maxLength(500)]
          : [Validators.maxLength(500)],
      );
      reason.updateValueAndValidity({ emitEvent: false });
    });
  }

  protected submit(): void {
    const m = this.motorcycle();
    if (!m) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { status, reason } = this.form.getRawValue();
    if (!status) return;
    this.saving.set(true);
    this.api.changeStatus(m.id, { status, reason: reason.trim() || null }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(`تم تغيير الحالة إلى «${enumLabel(MOTORCYCLE_STATUS, status)}»`);
        this.saved.emit();
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        // 422 (e.g. open repair) → the API's Arabic message as a toast.
        applyServerErrors(this.form, err, this.toast);
      },
    });
  }
}
