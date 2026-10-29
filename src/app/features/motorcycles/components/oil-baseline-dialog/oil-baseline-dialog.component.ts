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
import { ApiError } from '@core/models/api-response.model';
import { ToastService } from '@core/services/toast.service';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { KmPipe } from '@shared/pipes/format.pipes';
import { applyServerErrors } from '@shared/forms/server-errors';
import { MotorcyclesApi } from '../../data-access/motorcycles.api';
import { SetMaintenanceBaselineRequest } from '../../models/motorcycle.models';

type BaselineMode = 'distance' | 'odometer';

/**
 * `POST /maintenance/motorcycles/{id}/baseline` — for bikes whose last oil
 * change predates the system. Exactly one of the two distances is sent.
 */
@Component({
  selector: 'app-oil-baseline-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, FormErrorComponent, IconComponent, KmPipe],
  template: `
    <app-modal [open]="open()" title="ضبط عدّاد تغيير الزيت" size="md" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <p class="ob-text">
          استخدم هذا للموتوسيكلات التي تم تغيير زيتها قبل تشغيل النظام، ليبدأ حساب المسافة من آخر
          تغيير فعلي.
        </p>
        <div class="form-grid">
          <fieldset class="span-2 ob-modes">
            <legend class="form-label">طريقة الإدخال *</legend>
            <label class="ob-mode">
              <input
                type="radio"
                class="form-check-input"
                formControlName="mode"
                value="distance"
              />
              <span>
                <strong>المسافة منذ آخر تغيير زيت</strong>
                <small class="muted">كم كيلومترًا قطع الموتوسيكل منذ آخر تغيير</small>
              </span>
            </label>
            <label class="ob-mode">
              <input
                type="radio"
                class="form-check-input"
                formControlName="mode"
                value="odometer"
              />
              <span>
                <strong>قراءة العداد عند آخر تغيير</strong>
                <small class="muted">
                  قراءة العداد وقت التغيير
                  @if (currentOdometerKm() !== null) {
                    (القراءة الحالية {{ currentOdometerKm() | km }})
                  }
                </small>
              </span>
            </label>
          </fieldset>
          <div class="span-2">
            <label class="form-label" for="ob-km">
              {{ mode() === 'distance' ? 'المسافة (كم)' : 'قراءة العداد (كم)' }} *
            </label>
            <input
              id="ob-km"
              type="number"
              class="form-control ltr"
              min="0"
              step="1"
              formControlName="km"
            />
            <app-form-error [control]="form.controls.km" label="القيمة" />
          </div>
          <div class="span-2">
            <label class="form-label" for="ob-notes">ملاحظات</label>
            <textarea
              id="ob-notes"
              class="form-control"
              rows="2"
              formControlName="notes"
            ></textarea>
            <app-form-error [control]="form.controls.notes" label="الملاحظات" />
          </div>
          <p class="span-2 form-hint">
            <app-icon name="info" [size]="12" />
            سيُعاد حساب مستوى الزيت والتنبيهات بناءً على هذه القيمة.
          </p>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" (click)="closed.emit()">إلغاء</button>
          <button type="submit" class="btn btn-brand" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            }
            حفظ
          </button>
        </div>
      </form>
    </app-modal>
  `,
  styles: `
    .ob-text {
      margin: 0 0 0.75rem;
      font-size: var(--fs-sm);
      line-height: 1.8;
      color: var(--txt2);
    }
    .ob-modes {
      display: grid;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      border: 0;
    }
    .ob-mode {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      padding: 0.625rem 0.75rem;
      border: 1px solid var(--brd);
      border-radius: var(--r);
      cursor: pointer;
      span {
        display: grid;
        gap: 0.125rem;
      }
      small {
        font-size: var(--fs-xs);
      }
      &:has(input:checked) {
        border-color: var(--primary);
        background: var(--primary-soft);
      }
    }
  `,
})
export class OilBaselineDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(MotorcyclesApi);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly motorcycleId = input.required<string>();
  readonly currentOdometerKm = input<number | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    mode: ['distance' as BaselineMode],
    km: [
      null as number | null,
      [Validators.required, Validators.min(0), Validators.max(1_000_000)],
    ],
    notes: ['', Validators.maxLength(500)],
  });
  protected readonly mode = toSignal(this.form.controls.mode.valueChanges, {
    initialValue: 'distance' as BaselineMode,
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.form.reset({ mode: 'distance', km: null, notes: '' });
        this.saving.set(false);
      });
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { mode, km, notes } = this.form.getRawValue();
    const body: SetMaintenanceBaselineRequest =
      mode === 'distance'
        ? { distanceSinceLastMaintenanceKm: km, notes: notes.trim() || null }
        : { odometerAtLastMaintenanceKm: km, notes: notes.trim() || null };

    this.saving.set(true);
    this.api.setOilBaseline(this.motorcycleId(), body).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('تم ضبط عدّاد تغيير الزيت');
        this.saved.emit();
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        // Either distance field maps back onto the single input.
        const fe = err.fieldErrors ?? {};
        const msg = fe['distanceSinceLastMaintenanceKm'] ?? fe['odometerAtLastMaintenanceKm'];
        if (msg) {
          const text = Array.isArray(msg) ? msg[0] : msg;
          this.form.controls.km.setErrors({ server: text });
          this.form.controls.km.markAsTouched();
          return;
        }
        applyServerErrors(this.form, err, this.toast);
      },
    });
  }
}
