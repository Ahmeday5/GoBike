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
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Observable, map } from 'rxjs';
import { DriverCredentials, DriverDto } from '@core/models/domain.models';
import { ApiError } from '@core/models/api-response.model';
import { ToastService } from '@core/services/toast.service';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { PasswordInputComponent } from '@shared/components/password-input/password-input.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { DriversApi } from '../../data-access/drivers.api';
import {
  PasswordRulesComponent,
  driverPasswordValidator,
} from '../password-rules/password-rules.component';

/** `reset` → POST /drivers/{id}/reset-password · `account` → POST /drivers/{id}/account. */
export type PasswordDialogMode = 'reset' | 'account';

/**
 * Optional password entry for a driver's app login. Emits the one-time
 * credentials; the parent shows them in the credentials dialog.
 * (The "old password stops working" confirmation happens before opening.)
 */
@Component({
  selector: 'app-driver-password-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    ModalComponent,
    FormErrorComponent,
    PasswordInputComponent,
    PasswordRulesComponent,
  ],
  template: `
    <app-modal [open]="open()" [title]="title()" size="md" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <p class="muted" style="font-size: var(--fs-sm); margin: 0 0 0.875rem">
          @if (mode() === 'account') {
            سيتمكن السائق من الدخول إلى التطبيق برقم هاتفه
            <span class="ltr">{{ driver()?.phoneNumber }}</span>
            وكلمة المرور التالية.
          } @else {
            كلمة المرور الجديدة تحل محل القديمة فورًا، ويُسجَّل خروج السائق من التطبيق.
          }
        </p>
        <label class="form-label" for="dp-pw">كلمة المرور الجديدة (اختيارية)</label>
        <app-password-input
          inputId="dp-pw"
          formControlName="password"
          autocomplete="new-password"
          placeholder="اتركها فارغة للتوليد التلقائي"
        />
        <app-form-error [control]="form.controls.password" label="كلمة المرور" />
        <app-password-rules [value]="password()" />

        <div class="modal-actions">
          <button type="button" class="btn" (click)="closed.emit()">إلغاء</button>
          <button type="submit" class="btn btn-brand" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            }
            {{ mode() === 'account' ? 'إنشاء الحساب' : 'تعيين كلمة المرور' }}
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class DriverPasswordDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(DriversApi);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly mode = input<PasswordDialogMode>('reset');
  readonly driver = input<DriverDto | null>(null);
  readonly closed = output<void>();
  readonly done = output<DriverCredentials>();

  protected readonly saving = signal(false);
  protected readonly title = computed(() =>
    this.mode() === 'account' ? 'إنشاء حساب التطبيق' : 'تعيين كلمة مرور جديدة',
  );

  protected readonly form = this.fb.nonNullable.group({
    password: ['', driverPasswordValidator],
  });
  protected readonly password = toSignal(this.form.controls.password.valueChanges, {
    initialValue: '',
  });

  constructor() {
    effect(() => {
      if (this.open()) untracked(() => this.form.reset());
    });
  }

  protected submit(): void {
    const d = this.driver();
    if (!d) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const password = this.form.getRawValue().password || null;
    const request$: Observable<DriverCredentials> =
      this.mode() === 'account'
        ? this.api.createAccount(d.id, { password }).pipe(map((r) => r.credentials))
        : this.api.resetPassword(d.id, { newPassword: password });

    this.saving.set(true);
    request$.subscribe({
      next: (credentials) => {
        this.saving.set(false);
        this.toast.success(
          this.mode() === 'account' ? 'تم إنشاء حساب التطبيق' : 'تم تعيين كلمة المرور',
        );
        this.done.emit(credentials);
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        applyServerErrors(this.form, err, this.toast);
      },
    });
  }
}
