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
import { AuthService } from '@core/auth/services/auth.service';
import { ApiError } from '@core/models/api-response.model';
import { StaffUserDto } from '@core/models/domain.models';
import { ToastService } from '@core/services/toast.service';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { UsersApi } from '../../data-access/users.api';
import { injectRoleOptions } from '../../data-access/role-options';
import { ChipMultiselectComponent } from '../chip-multiselect/chip-multiselect.component';

/** `PUT /users/{id}/roles` — replaces the user's whole role list. */
@Component({
  selector: 'app-user-roles-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, IconComponent, ChipMultiselectComponent],
  template: `
    <app-modal [open]="open()" title="أدوار المستخدم" size="md" (closed)="closed.emit()">
      @if (user(); as u) {
        <p class="ur-lead">
          اختر أدوار <strong>{{ u.fullName }}</strong
          >. الصلاحيات الفعلية هي مجموع صلاحيات كل الأدوار المختارة.
        </p>
        <app-chip-multiselect
          label="الأدوار"
          [options]="roleOptions()"
          [value]="roles()"
          [disabled]="saving()"
          (valueChange)="roles.set($event)"
        />
        @if (!roles().length) {
          <div class="invalid-feedback d-block" role="alert">اختر دورًا واحدًا على الأقل.</div>
        }
        @if (isSelf()) {
          <p class="form-hint ur-self">
            <app-icon name="alert" [size]="12" />
            هذا حسابك: تتغير صلاحياتك فور الحفظ، وقد تفقد الوصول إلى هذه الصفحة.
          </p>
        }
      }
      <div class="modal-actions">
        <button type="button" class="btn" (click)="closed.emit()">إلغاء</button>
        <button
          type="button"
          class="btn btn-brand"
          [disabled]="saving() || !roles().length || !changed()"
          (click)="save()"
        >
          @if (saving()) {
            <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
          }
          حفظ الأدوار
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .ur-lead {
      margin: 0 0 0.875rem;
      font-size: var(--fs-sm);
      color: var(--txt2);
      line-height: 1.7;
    }
    .ur-self {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      color: var(--am);
    }
  `,
})
export class UserRolesDialogComponent {
  private readonly api = inject(UsersApi);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly open = input.required<boolean>();
  readonly user = input<StaffUserDto | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly roleOptions = injectRoleOptions();
  protected readonly roles = signal<string[]>([]);
  protected readonly saving = signal(false);
  protected readonly isSelf = computed(() => this.user()?.id === this.auth.currentUser()?.id);
  protected readonly changed = computed(() => {
    const before = [...(this.user()?.roles ?? [])].sort().join('|');
    return before !== [...this.roles()].sort().join('|');
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const u = this.user();
      untracked(() => {
        this.roles.set([...(u?.roles ?? [])]);
        this.saving.set(false);
      });
    });
  }

  protected save(): void {
    const u = this.user();
    if (!u || !this.roles().length) return;
    this.saving.set(true);
    this.api.setRoles(u.id, { roles: this.roles() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('تم تحديث أدوار المستخدم');
        if (this.isSelf()) this.auth.refreshProfile().subscribe();
        this.saved.emit();
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        this.toast.error(err.message);
      },
    });
  }
}
