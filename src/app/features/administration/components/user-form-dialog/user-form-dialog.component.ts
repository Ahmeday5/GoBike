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
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { AuthService } from '@core/auth/services/auth.service';
import { LookupService } from '@core/data/lookup.service';
import { ApiError } from '@core/models/api-response.model';
import { StaffUserDto } from '@core/models/domain.models';
import { ToastService } from '@core/services/toast.service';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { PasswordInputComponent } from '@shared/components/password-input/password-input.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { UsersApi } from '../../data-access/users.api';
import { injectRoleOptions } from '../../data-access/role-options';
import { CreateUserRequest, UpdateUserRequest, generatePassword } from '../../models/user.models';
import { ChipMultiselectComponent } from '../chip-multiselect/chip-multiselect.component';
import {
  StaffPasswordRulesComponent,
  staffPasswordValidator,
} from '../staff-password-rules/staff-password-rules.component';
import { StaffCredentials } from '../user-credentials-dialog/user-credentials-dialog.component';

const EMAIL_TAKEN = 'البريد الإلكتروني مستخدم بالفعل لحساب آخر';

const atLeastOne = (c: AbstractControl): ValidationErrors | null =>
  Array.isArray(c.value) && c.value.length ? null : { required: true };

/**
 * Add a dashboard user (email + initial password + roles → `created` carries
 * the one-time credentials) or edit one (`user` set → name/phone/office only;
 * roles and password have their own actions).
 */
@Component({
  selector: 'app-user-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    ModalComponent,
    FormErrorComponent,
    PasswordInputComponent,
    IconComponent,
    ChipMultiselectComponent,
    StaffPasswordRulesComponent,
  ],
  template: `
    <app-modal
      [open]="open()"
      [title]="editing() ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم'"
      size="lg"
      (closed)="closed.emit()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="form-grid">
          <h3 class="form-section-title">البيانات الأساسية</h3>

          <div class="span-2">
            <label class="form-label" for="u-name">الاسم الكامل *</label>
            <input id="u-name" class="form-control" formControlName="fullName" autocomplete="off" />
            <app-form-error [control]="form.controls.fullName" label="الاسم" />
          </div>
          <div>
            <label class="form-label" for="u-email"
              >البريد الإلكتروني {{ editing() ? '' : '*' }}</label
            >
            <input
              id="u-email"
              type="email"
              class="form-control"
              formControlName="email"
              dir="ltr"
              autocomplete="off"
            />
            <app-form-error [control]="form.controls.email" label="البريد الإلكتروني" />
            <p class="form-hint">
              @if (editing()) {
                البريد هو اسم الدخول ولا يمكن تغييره.
              } @else {
                يستخدمه المستخدم لتسجيل الدخول إلى لوحة التحكم.
              }
            </p>
          </div>
          <div>
            <label class="form-label" for="u-phone">رقم الهاتف</label>
            <input
              id="u-phone"
              type="tel"
              class="form-control"
              formControlName="phoneNumber"
              dir="ltr"
              inputmode="tel"
              placeholder="01xxxxxxxxx"
              autocomplete="off"
            />
            <app-form-error [control]="form.controls.phoneNumber" label="رقم الهاتف" />
          </div>

          <div class="span-2">
            <label class="form-label" for="u-office">المكتب</label>
            <select id="u-office" class="form-select" formControlName="officeId">
              @if (canPickCompanyWide()) {
                <option value="">على مستوى الشركة (كل المكاتب)</option>
              }
              @for (o of offices(); track o.id) {
                <option [value]="o.id">{{ o.name }}</option>
              }
            </select>
            <app-form-error [control]="form.controls.officeId" label="المكتب" />
            <p class="form-hint">
              <app-icon name="info" [size]="12" />
              مستخدم المكتب يرى بيانات مكتبه فقط؛ مستخدم الشركة يرى كل المكاتب.
            </p>
          </div>

          @if (!editing()) {
            <h3 class="form-section-title">الأدوار *</h3>
            <div class="span-2">
              <app-chip-multiselect
                label="الأدوار"
                [options]="roleOptions()"
                [value]="form.controls.roles.value"
                (valueChange)="setRoles($event)"
              />
              <app-form-error [control]="form.controls.roles" label="دور واحد على الأقل" />
              <p class="form-hint">الصلاحيات تأتي من الأدوار، ويمكن تعديلها من صفحة الأدوار.</p>
            </div>

            <h3 class="form-section-title">كلمة المرور المبدئية</h3>
            <div class="span-2">
              <label class="form-label" for="u-pw">كلمة المرور *</label>
              <div class="uf-pw">
                <app-password-input
                  class="uf-pw__input"
                  inputId="u-pw"
                  formControlName="password"
                  autocomplete="new-password"
                />
                <button type="button" class="btn" (click)="generate()">
                  <app-icon name="refresh" [size]="16" />
                  توليد
                </button>
              </div>
              <app-form-error [control]="form.controls.password" label="كلمة المرور" />
              <app-staff-password-rules [value]="password()" />
              <p class="form-hint">ستظهر لك كلمة المرور مرة واحدة بعد الحفظ لتسليمها للمستخدم.</p>
            </div>
          }
        </div>

        <div class="modal-actions">
          <button type="button" class="btn" (click)="closed.emit()">إلغاء</button>
          <button type="submit" class="btn btn-brand" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            }
            {{ editing() ? 'حفظ التعديلات' : 'إضافة المستخدم' }}
          </button>
        </div>
      </form>
    </app-modal>
  `,
  styles: `
    .uf-pw {
      display: flex;
      gap: 0.5rem;
      align-items: stretch;
    }
    .uf-pw__input {
      flex: 1;
      min-width: 0;
    }
  `,
})
export class UserFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(UsersApi);
  private readonly toast = inject(ToastService);
  private readonly lookups = inject(LookupService);
  private readonly auth = inject(AuthService);

  readonly open = input.required<boolean>();
  readonly user = input<StaffUserDto | null>(null);
  readonly closed = output<void>();
  readonly created = output<StaffCredentials>();
  readonly saved = output<void>();

  protected readonly offices = toSignal(this.lookups.offices(), { initialValue: [] });
  protected readonly roleOptions = injectRoleOptions();
  protected readonly saving = signal(false);
  protected readonly editing = computed(() => !!this.user());
  /** Only company-wide users may create other company-wide users. */
  protected readonly canPickCompanyWide = computed(() => !!this.auth.currentUser()?.hasGlobalScope);

  protected readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
    phoneNumber: ['', Validators.pattern(/^\+?[\d\s-]{8,20}$/)],
    officeId: [''],
    roles: [[] as string[], atLeastOne],
    password: ['', staffPasswordValidator],
  });

  protected readonly password = toSignal(this.form.controls.password.valueChanges, {
    initialValue: '',
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const u = this.user();
      untracked(() => this.fill(u));
    });
  }

  private fill(u: StaffUserDto | null): void {
    this.form.reset();
    const c = this.form.controls;
    if (u) {
      this.form.patchValue({
        fullName: u.fullName,
        email: u.email,
        phoneNumber: u.phoneNumber ?? '',
        officeId: u.officeId ?? '',
      });
      c.email.disable();
      c.roles.disable();
      c.password.disable();
    } else {
      c.email.enable();
      c.roles.enable();
      c.password.enable();
      const own = this.auth.currentUser();
      if (own && !own.hasGlobalScope && own.officeId) c.officeId.setValue(own.officeId);
    }
  }

  protected setRoles(roles: string[]): void {
    const c = this.form.controls.roles;
    c.setValue(roles);
    c.markAsTouched();
  }

  protected generate(): void {
    const c = this.form.controls.password;
    c.setValue(generatePassword());
    c.markAsDirty();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const base: UpdateUserRequest = {
      fullName: v.fullName.trim(),
      phoneNumber: v.phoneNumber.trim() || null,
      officeId: v.officeId || null,
    };
    const editing = this.user();
    this.saving.set(true);
    const fail = (err: ApiError) => {
      this.saving.set(false);
      if (err.status === 409 && !editing) {
        const email = this.form.controls.email;
        email.setErrors({ server: err.message || EMAIL_TAKEN });
        email.markAsTouched();
        return;
      }
      applyServerErrors(this.form, err, this.toast);
    };

    if (editing) {
      this.api.update(editing.id, base).subscribe({
        next: () => {
          this.saving.set(false);
          this.lookups.invalidate();
          this.toast.success('تم حفظ بيانات المستخدم');
          this.saved.emit();
        },
        error: fail,
      });
      return;
    }

    const body: CreateUserRequest = {
      ...base,
      email: v.email.trim(),
      password: v.password,
      roles: v.roles,
    };
    this.api.create(body).subscribe({
      next: () => {
        this.saving.set(false);
        this.lookups.invalidate();
        this.toast.success('تمت إضافة المستخدم');
        this.created.emit({
          fullName: body.fullName,
          email: body.email,
          password: body.password,
          isNew: true,
        });
      },
      error: fail,
    });
  }
}
