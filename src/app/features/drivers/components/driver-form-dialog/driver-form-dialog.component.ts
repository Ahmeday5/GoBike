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
import { AuthService } from '@core/auth/services/auth.service';
import { LookupService } from '@core/data/lookup.service';
import { DriverDto } from '@core/models/domain.models';
import { ApiError } from '@core/models/api-response.model';
import { ToastService } from '@core/services/toast.service';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { PasswordInputComponent } from '@shared/components/password-input/password-input.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { DriversApi } from '../../data-access/drivers.api';
import { DriverWithCredentials, SaveDriverRequest } from '../../models/driver.models';
import {
  PasswordRulesComponent,
  driverPasswordValidator,
} from '../password-rules/password-rules.component';

const PHONE_TAKEN = 'رقم الهاتف مستخدم بالفعل لحساب آخر';

/**
 * Add a driver (creates the app login in the same step → `created` carries
 * the one-time credentials) or edit one (`driver` set → `saved`).
 */
@Component({
  selector: 'app-driver-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    ModalComponent,
    FormErrorComponent,
    PasswordInputComponent,
    PasswordRulesComponent,
    IconComponent,
  ],
  templateUrl: './driver-form-dialog.component.html',
})
export class DriverFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(DriversApi);
  private readonly toast = inject(ToastService);
  private readonly lookups = inject(LookupService);
  private readonly auth = inject(AuthService);

  readonly open = input.required<boolean>();
  readonly driver = input<DriverDto | null>(null);
  readonly closed = output<void>();
  readonly created = output<DriverWithCredentials>();
  readonly saved = output<DriverDto>();

  protected readonly offices = toSignal(this.lookups.offices(), { initialValue: [] });
  protected readonly staff = toSignal(this.lookups.staff(), { initialValue: [] });
  protected readonly saving = signal(false);
  protected readonly editing = computed(() => !!this.driver());

  protected readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(150)]],
    phoneNumber: ['', [Validators.required, Validators.pattern(/^\+?[\d\s-]{8,20}$/)]],
    nationalId: ['', Validators.maxLength(20)],
    licenseNumber: [''],
    licenseExpiryDate: [''],
    address: [''],
    officeId: ['', Validators.required],
    supervisorUserId: [''],
    password: ['', driverPasswordValidator],
  });

  protected readonly password = toSignal(this.form.controls.password.valueChanges, {
    initialValue: '',
  });

  constructor() {
    // (Re)fill the form every time the dialog opens.
    effect(() => {
      if (!this.open()) return;
      const d = this.driver();
      untracked(() => {
        this.form.reset();
        if (d) {
          this.form.patchValue({
            fullName: d.fullName,
            phoneNumber: d.phoneNumber,
            nationalId: d.nationalId ?? '',
            licenseNumber: d.licenseNumber ?? '',
            licenseExpiryDate: d.licenseExpiryDate?.slice(0, 10) ?? '',
            address: d.address ?? '',
            officeId: d.officeId,
            supervisorUserId: d.supervisorUserId ?? '',
          });
        } else {
          // Office-scoped users can only add drivers to their own office.
          const own = this.auth.currentUser()?.officeId;
          if (own) this.form.controls.officeId.setValue(own);
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
    const body: SaveDriverRequest = {
      fullName: v.fullName.trim(),
      phoneNumber: v.phoneNumber.trim(),
      nationalId: v.nationalId || null,
      licenseNumber: v.licenseNumber || null,
      licenseExpiryDate: v.licenseExpiryDate || null,
      address: v.address || null,
      officeId: v.officeId,
      supervisorUserId: v.supervisorUserId || null,
    };

    const editing = this.driver();
    this.saving.set(true);
    const done = () => this.saving.set(false);
    const fail = (err: ApiError) => {
      done();
      if (err.status === 409) {
        const phone = this.form.controls.phoneNumber;
        phone.setErrors({ server: PHONE_TAKEN });
        phone.markAsTouched();
        return;
      }
      applyServerErrors(this.form, err, this.toast);
    };

    if (editing) {
      this.api.update(editing.id, body).subscribe({
        next: (d) => {
          done();
          this.toast.success('تم حفظ بيانات السائق');
          this.saved.emit(d);
        },
        error: fail,
      });
      return;
    }
    this.api.create({ ...body, password: v.password || null }).subscribe({
      next: (res) => {
        done();
        this.toast.success('تمت إضافة السائق وإنشاء حساب التطبيق');
        this.created.emit(res);
      },
      error: fail,
    });
  }
}
