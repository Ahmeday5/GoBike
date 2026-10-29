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
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ApiError } from '@core/models/api-response.model';
import { ToastService } from '@core/services/toast.service';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { RolesApi } from '../../data-access/roles.api';
import { RESERVED_ROLE_NAME, RoleView, isReservedRole, roleLabel } from '../../models/role.models';

/**
 * New role (`POST /roles`). Optionally starts from another role's
 * permissions so admins tweak instead of ticking 30 boxes.
 */
@Component({
  selector: 'app-role-create-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, FormErrorComponent],
  template: `
    <app-modal [open]="open()" title="دور جديد" size="md" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="form-grid">
          <div class="span-2">
            <label class="form-label" for="r-name">اسم الدور *</label>
            <input
              id="r-name"
              class="form-control"
              formControlName="name"
              dir="ltr"
              autocomplete="off"
              placeholder="Supervisor"
            />
            <app-form-error [control]="form.controls.name" label="اسم الدور" />
            <p class="form-hint">
              اسم قصير بالإنجليزية بدون مسافات. الاسم «{{ reserved }}» محجوز لتطبيق السائقين.
            </p>
          </div>
          <div class="span-2">
            <label class="form-label" for="r-from">ابدأ بصلاحيات دور</label>
            <select id="r-from" class="form-select" formControlName="copyFrom">
              <option value="">بدون صلاحيات (أختارها بعد الإنشاء)</option>
              @for (r of roles(); track r.name) {
                <option [value]="r.name">
                  {{ label(r.name) }} ({{ r.permissions.length }} صلاحية)
                </option>
              }
            </select>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" (click)="closed.emit()">إلغاء</button>
          <button type="submit" class="btn btn-brand" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            }
            إنشاء الدور
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class RoleCreateDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(RolesApi);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly roles = input<readonly RoleView[]>([]);
  readonly closed = output<void>();
  readonly created = output<string>();

  protected readonly reserved = RESERVED_ROLE_NAME;
  protected readonly label = roleLabel;
  protected readonly saving = signal(false);

  private readonly notReservedOrTaken = (c: AbstractControl): ValidationErrors | null => {
    const v = String(c.value ?? '').trim();
    if (!v) return null;
    if (isReservedRole(v))
      return { server: `الاسم «${RESERVED_ROLE_NAME}» محجوز ولا يمكن استخدامه` };
    if (this.roles().some((r) => r.name.toLowerCase() === v.toLowerCase())) {
      return { server: 'يوجد دور بهذا الاسم بالفعل' };
    }
    return null;
  };

  protected readonly form = this.fb.nonNullable.group({
    name: [
      '',
      [
        Validators.required,
        Validators.maxLength(50),
        Validators.pattern(/^[A-Za-z][A-Za-z0-9_.-]*$/),
        this.notReservedOrTaken,
      ],
    ],
    copyFrom: [''],
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

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const name = v.name.trim();
    const permissions = this.roles().find((r) => r.name === v.copyFrom)?.permissions ?? [];
    this.saving.set(true);
    this.api.create({ name, permissions }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('تم إنشاء الدور');
        this.created.emit(name);
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        applyServerErrors(this.form, err, this.toast);
      },
    });
  }
}
