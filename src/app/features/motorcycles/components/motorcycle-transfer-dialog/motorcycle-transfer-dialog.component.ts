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
import { LookupService } from '@core/data/lookup.service';
import { MotorcycleDto } from '@core/models/domain.models';
import { ApiError } from '@core/models/api-response.model';
import { ToastService } from '@core/services/toast.service';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { MotorcyclesApi } from '../../data-access/motorcycles.api';

/** `POST /motorcycles/{id}/transfer` — move a bike to another office (+ optional supervisor). */
@Component({
  selector: 'app-motorcycle-transfer-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, FormErrorComponent, IconComponent],
  template: `
    <app-modal
      [open]="open()"
      title="نقل الموتوسيكل إلى مكتب آخر"
      size="md"
      (closed)="closed.emit()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="form-grid">
          <p class="span-2 form-hint mt-0">
            <app-icon name="building" [size]="12" />
            المكتب الحالي: <strong>{{ motorcycle()?.officeName ?? '—' }}</strong>
          </p>
          <div class="span-2">
            <label class="form-label" for="mt-office">المكتب الجديد *</label>
            <select id="mt-office" class="form-select" formControlName="toOfficeId">
              <option value="">اختر المكتب</option>
              @for (o of officeOptions(); track o.id) {
                <option [value]="o.id">{{ o.name }}</option>
              }
            </select>
            <app-form-error [control]="form.controls.toOfficeId" label="المكتب" />
          </div>
          <div class="span-2">
            <label class="form-label" for="mt-supervisor">المشرف في المكتب الجديد</label>
            <select id="mt-supervisor" class="form-select" formControlName="toSupervisorUserId">
              <option value="">بدون مشرف</option>
              @for (u of supervisorOptions(); track u.id) {
                <option [value]="u.id">{{ u.fullName }}</option>
              }
            </select>
            <app-form-error [control]="form.controls.toSupervisorUserId" label="المشرف" />
          </div>
          <div class="span-2">
            <label class="form-label" for="mt-reason">سبب النقل</label>
            <textarea
              id="mt-reason"
              class="form-control"
              rows="3"
              formControlName="reason"
            ></textarea>
            <app-form-error [control]="form.controls.reason" label="السبب" />
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" (click)="closed.emit()">إلغاء</button>
          <button type="submit" class="btn btn-brand" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            }
            نقل الموتوسيكل
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class MotorcycleTransferDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(MotorcyclesApi);
  private readonly toast = inject(ToastService);
  private readonly lookups = inject(LookupService);

  readonly open = input.required<boolean>();
  readonly motorcycle = input<MotorcycleDto | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  private readonly offices = toSignal(this.lookups.offices(), { initialValue: [] });
  private readonly staff = toSignal(this.lookups.staff(), { initialValue: [] });

  protected readonly form = this.fb.nonNullable.group({
    toOfficeId: ['', Validators.required],
    toSupervisorUserId: [''],
    reason: ['', Validators.maxLength(500)],
  });
  private readonly officeId = toSignal(this.form.controls.toOfficeId.valueChanges, {
    initialValue: '',
  });

  protected readonly officeOptions = computed(() =>
    this.offices().filter((o) => o.id !== this.motorcycle()?.officeId),
  );
  /** Staff of the chosen office (plus users without an office, e.g. global admins). */
  protected readonly supervisorOptions = computed(() => {
    const office = this.officeId();
    return this.staff().filter((u) => !office || !u.officeId || u.officeId === office);
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.form.reset();
        this.saving.set(false);
      });
    });
    // A supervisor from the previously chosen office no longer applies.
    this.form.controls.toOfficeId.valueChanges.subscribe(() =>
      this.form.controls.toSupervisorUserId.setValue(''),
    );
  }

  protected submit(): void {
    const m = this.motorcycle();
    if (!m) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .transfer(m.id, {
        toOfficeId: v.toOfficeId,
        toSupervisorUserId: v.toSupervisorUserId || null,
        reason: v.reason.trim() || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          const office = this.offices().find((o) => o.id === v.toOfficeId)?.name ?? '';
          this.toast.success(`تم نقل الموتوسيكل إلى ${office}`.trim());
          this.saved.emit();
        },
        error: (err: ApiError) => {
          this.saving.set(false);
          applyServerErrors(this.form, err, this.toast);
        },
      });
  }
}
