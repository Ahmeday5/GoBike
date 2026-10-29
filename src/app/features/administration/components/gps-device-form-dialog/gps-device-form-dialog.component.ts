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
import { ToastService } from '@core/services/toast.service';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { GpsDevicesApi } from '../../data-access/gps-devices.api';
import { GpsDeviceDto, deviceName } from '../../models/gps-device.models';

/**
 * Register a tracker (`POST /gps/devices`: IMEI + name) or edit one
 * (`PUT /gps/devices/{id}`: the API only accepts active flag + notes).
 */
@Component({
  selector: 'app-gps-device-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, FormErrorComponent, IconComponent],
  template: `
    <app-modal
      [open]="open()"
      [title]="device() ? 'تعديل جهاز التتبع' : 'تسجيل جهاز تتبع'"
      size="md"
      (closed)="closed.emit()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="form-grid">
          <div class="span-2">
            <label class="form-label" for="g-imei">رقم IMEI *</label>
            <input
              id="g-imei"
              class="form-control"
              formControlName="imei"
              dir="ltr"
              inputmode="numeric"
              autocomplete="off"
              placeholder="358000000000000"
            />
            <app-form-error [control]="form.controls.imei" label="رقم IMEI" />
            @if (!device()) {
              <p class="form-hint">
                الرقم المطبوع على الجهاز (15 رقمًا عادةً)، كما هو مسجل لدى مزود التتبع.
              </p>
            }
          </div>
          <div class="span-2">
            <label class="form-label" for="g-name">اسم الجهاز</label>
            <input
              id="g-name"
              class="form-control"
              formControlName="deviceName"
              autocomplete="off"
            />
            <app-form-error [control]="form.controls.deviceName" label="اسم الجهاز" />
            @if (device()) {
              <p class="form-hint">
                <app-icon name="info" [size]="12" />
                رقم IMEI والاسم لا يتغيران بعد التسجيل.
              </p>
            }
          </div>
          <div class="span-2">
            <label class="form-label" for="g-notes">ملاحظات</label>
            <textarea id="g-notes" class="form-control" rows="2" formControlName="notes"></textarea>
            <app-form-error [control]="form.controls.notes" label="الملاحظات" />
          </div>
          @if (device()) {
            <div class="span-2">
              <div class="form-check form-switch">
                <input
                  id="g-active"
                  class="form-check-input"
                  type="checkbox"
                  role="switch"
                  formControlName="isActive"
                />
                <label class="form-check-label" for="g-active">الجهاز مفعّل</label>
              </div>
              <p class="form-hint">الجهاز الموقوف لا تُستقبل بياناته ولا تُطلق منه تنبيهات.</p>
            </div>
          }
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" (click)="closed.emit()">إلغاء</button>
          <button type="submit" class="btn btn-brand" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            }
            {{ device() ? 'حفظ التعديلات' : 'تسجيل الجهاز' }}
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class GpsDeviceFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(GpsDevicesApi);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly device = input<GpsDeviceDto | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    imei: ['', [Validators.required, Validators.pattern(/^\d{8,20}$/)]],
    deviceName: ['', Validators.maxLength(100)],
    notes: ['', Validators.maxLength(500)],
    isActive: [true],
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const d = this.device();
      untracked(() => {
        this.form.reset();
        this.saving.set(false);
        const c = this.form.controls;
        if (d) {
          this.form.patchValue({
            imei: d.imei,
            deviceName: deviceName(d) ?? '',
            notes: d.notes ?? '',
            isActive: d.isActive ?? true,
          });
          c.imei.disable();
          c.deviceName.disable();
        } else {
          c.imei.enable();
          c.deviceName.enable();
        }
      });
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const editing = this.device();
    const notes = v.notes.trim() || null;
    const request$ = editing
      ? this.api.update(editing.id, { isActive: v.isActive, notes })
      : this.api.register({ imei: v.imei.trim(), deviceName: v.deviceName.trim() || null, notes });
    this.saving.set(true);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(editing ? 'تم حفظ بيانات الجهاز' : 'تم تسجيل الجهاز');
        this.saved.emit();
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        if (err.status === 409 && !editing) {
          const imei = this.form.controls.imei;
          imei.setErrors({ server: err.message || 'هذا الجهاز مسجل بالفعل' });
          imei.markAsTouched();
          return;
        }
        applyServerErrors(this.form, err, this.toast);
      },
    });
  }
}
