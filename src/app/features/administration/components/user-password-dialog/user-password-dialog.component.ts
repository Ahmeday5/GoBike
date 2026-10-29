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
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ApiError } from '@core/models/api-response.model';
import { StaffUserDto } from '@core/models/domain.models';
import { ToastService } from '@core/services/toast.service';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { PasswordInputComponent } from '@shared/components/password-input/password-input.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { UsersApi } from '../../data-access/users.api';
import { generatePassword } from '../../models/user.models';
import {
  StaffPasswordRulesComponent,
  staffPasswordValidator,
} from '../staff-password-rules/staff-password-rules.component';
import { StaffCredentials } from '../user-credentials-dialog/user-credentials-dialog.component';

/**
 * Admin password reset (`POST /users/{id}/reset-password`). There is no
 * self-service change, so this is the only way a staff password changes.
 * Emits the new credentials; the parent shows them once.
 */
@Component({
  selector: 'app-user-password-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    ModalComponent,
    FormErrorComponent,
    PasswordInputComponent,
    IconComponent,
    StaffPasswordRulesComponent,
  ],
  template: `
    <app-modal [open]="open()" title="إعادة تعيين كلمة المرور" size="md" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <p class="up-lead">
          كلمة المرور الجديدة لـ <strong>{{ user()?.fullName }}</strong> تحل محل القديمة فورًا.
          اكتبها أو ولّد واحدة قوية، وستظهر لك مرة واحدة بعد الحفظ.
        </p>
        <label class="form-label" for="up-pw">كلمة المرور الجديدة *</label>
        <div class="up-row">
          <app-password-input
            class="up-row__input"
            inputId="up-pw"
            formControlName="newPassword"
            autocomplete="new-password"
          />
          <button type="button" class="btn" (click)="generate()">
            <app-icon name="refresh" [size]="16" />
            توليد
          </button>
        </div>
        <app-form-error [control]="form.controls.newPassword" label="كلمة المرور" />
        <app-staff-password-rules [value]="password()" />

        <div class="modal-actions">
          <button type="button" class="btn" (click)="closed.emit()">إلغاء</button>
          <button type="submit" class="btn btn-brand" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            }
            تعيين كلمة المرور
          </button>
        </div>
      </form>
    </app-modal>
  `,
  styles: `
    .up-lead {
      margin: 0 0 0.875rem;
      font-size: var(--fs-sm);
      color: var(--txt2);
      line-height: 1.7;
    }
    .up-row {
      display: flex;
      gap: 0.5rem;
    }
    .up-row__input {
      flex: 1;
      min-width: 0;
    }
  `,
})
export class UserPasswordDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(UsersApi);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly user = input<StaffUserDto | null>(null);
  readonly closed = output<void>();
  readonly done = output<StaffCredentials>();

  protected readonly saving = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    newPassword: ['', staffPasswordValidator],
  });
  protected readonly password = toSignal(this.form.controls.newPassword.valueChanges, {
    initialValue: '',
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.form.reset();
        this.saving.set(false);
      });
    });
  }

  protected generate(): void {
    const c = this.form.controls.newPassword;
    c.setValue(generatePassword());
    c.markAsDirty();
  }

  protected submit(): void {
    const u = this.user();
    if (!u) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const newPassword = this.form.getRawValue().newPassword;
    this.saving.set(true);
    this.api.resetPassword(u.id, { newPassword }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('تم تعيين كلمة المرور الجديدة');
        this.done.emit({
          fullName: u.fullName,
          email: u.email,
          password: newPassword,
          isNew: false,
        });
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        applyServerErrors(this.form, err, this.toast);
      },
    });
  }
}
