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
import { ApiError } from '@core/models/api-response.model';
import { MaintenanceRecordDto } from '@core/models/domain.models';
import { DialogService } from '@core/services/dialog.service';
import { ToastService } from '@core/services/toast.service';
import { cairoInputToUtc, cairoNowInput } from '@core/utils/cairo-time.util';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { MaintenanceApi } from '../../data-access/maintenance.api';
import { CompleteMaintenanceRequest, moneyOrNull } from '../../models/maintenance.models';

/**
 * Complete a general (non-inspection) record — `POST /maintenance/records/{id}/complete`.
 * Wrap-up fields are optional and prefilled from the record.
 */
@Component({
  selector: 'app-complete-record-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, FormErrorComponent],
  template: `
    <app-modal [open]="open()" title="إكمال الصيانة" size="md" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="form-grid">
          <div>
            <label class="form-label" for="cr-at">وقت الإكمال *</label>
            <input
              id="cr-at"
              type="datetime-local"
              class="form-control"
              formControlName="completedAt"
            />
            <div class="form-hint">بتوقيت القاهرة.</div>
            <app-form-error [control]="form.controls.completedAt" label="وقت الإكمال" />
          </div>
          <div></div>
          <div class="span-2">
            <label class="form-label" for="cr-work">الأعمال المنفذة</label>
            <textarea
              id="cr-work"
              class="form-control"
              rows="3"
              formControlName="workPerformed"
            ></textarea>
            <app-form-error [control]="form.controls.workPerformed" label="الأعمال المنفذة" />
          </div>
          <div>
            <label class="form-label" for="cr-labor">المصنعية (ج.م)</label>
            <input
              id="cr-labor"
              type="number"
              class="form-control"
              formControlName="laborCost"
              min="0"
              step="0.01"
            />
            <app-form-error [control]="form.controls.laborCost" label="المصنعية" />
          </div>
          <div>
            <label class="form-label" for="cr-other">تكاليف أخرى (ج.م)</label>
            <input
              id="cr-other"
              type="number"
              class="form-control"
              formControlName="otherCost"
              min="0"
              step="0.01"
            />
            <app-form-error [control]="form.controls.otherCost" label="تكاليف أخرى" />
          </div>
          <div class="span-2">
            <label class="form-label" for="cr-notes">ملاحظات</label>
            <input id="cr-notes" class="form-control" formControlName="notes" />
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" (click)="closed.emit()">إلغاء</button>
          <button type="submit" class="btn btn-gr" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            }
            إكمال الصيانة
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class CompleteRecordDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(MaintenanceApi);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly record = input.required<MaintenanceRecordDto | null>();
  readonly closed = output<void>();
  readonly done = output<void>();

  protected readonly saving = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    completedAt: ['', Validators.required],
    workPerformed: ['', Validators.maxLength(2000)],
    laborCost: [null as number | null, Validators.min(0)],
    otherCost: [null as number | null, Validators.min(0)],
    notes: ['', Validators.maxLength(2000)],
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const r = this.record();
      untracked(() => {
        this.saving.set(false);
        this.form.reset({
          completedAt: cairoNowInput(),
          workPerformed: r?.workPerformed ?? '',
          laborCost: r?.laborCost ?? null,
          otherCost: r?.otherCost ?? null,
          notes: r?.notes ?? '',
        });
      });
    });
  }

  protected async submit(): Promise<void> {
    const r = this.record();
    if (!r) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const ok = await this.dialog.confirm({
      title: 'إكمال الصيانة',
      message:
        `سيُغلق سجل صيانة الموتوسيكل ${r.plateNumber ?? ''} كمكتمل` +
        (r.resetsMaintenanceCycle ? ' ويُصفَّر عدّاد تغيير الزيت.' : '.'),
      type: 'info',
      confirmText: 'إكمال',
    });
    if (!ok) return;

    const v = this.form.getRawValue();
    const body: CompleteMaintenanceRequest = {
      completedAtUtc: cairoInputToUtc(v.completedAt),
      workPerformed: v.workPerformed.trim() || null,
      laborCost: moneyOrNull(v.laborCost),
      otherCost: moneyOrNull(v.otherCost),
      notes: v.notes.trim() || null,
    };
    this.saving.set(true);
    this.api.complete(r.id, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('تم إكمال الصيانة');
        this.done.emit();
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        applyServerErrors(this.form, err, this.toast);
      },
    });
  }
}
