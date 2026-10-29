import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { AuthService } from '@core/auth/services/auth.service';
import { STAFF_ROLE, enumMeta } from '@core/constants/enums';
import { createResource } from '@core/data/resource';
import { injectUrlState } from '@core/routing/url-state';
import { DialogService } from '@core/services/dialog.service';
import { ToastService } from '@core/services/toast.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { ChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { NumberPipe } from '@shared/pipes/format.pipes';
import { RolesApi } from '../../data-access/roles.api';
import { ADMIN_ROLE_NAME, RoleView, roleLabel } from '../../models/role.models';
import { PermissionMatrixComponent } from '../../components/permission-matrix/permission-matrix.component';
import { RoleCreateDialogComponent } from '../../components/role-create-dialog/role-create-dialog.component';

const sameSet = (a: readonly string[], b: readonly string[]): boolean => {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
};

/**
 * Settings → Roles: what each role may do. Pick a role, tick permissions by
 * area, save. The selected role lives in the URL (`?role=`).
 */
@Component({
  selector: 'app-roles',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    EmptyStateComponent,
    ChipComponent,
    IconComponent,
    NumberPipe,
    PermissionMatrixComponent,
    RoleCreateDialogComponent,
  ],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.scss',
})
export class RolesComponent {
  private readonly api = inject(RolesApi);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly url = injectUrlState({ role: '' });
  protected readonly label = roleLabel;
  protected readonly roleIcon = (name: string): string =>
    enumMeta(STAFF_ROLE, name).icon ?? 'shield';

  protected readonly roles = createResource(
    () => true,
    () => this.api.list(),
  );
  protected readonly catalog = createResource(
    () => true,
    () => this.api.permissions(),
  );

  protected readonly list = computed(() => this.roles.value() ?? []);
  protected readonly selected = computed<RoleView | null>(() => {
    const list = this.list();
    const name = this.url.state().role;
    return list.find((r) => r.name === name) ?? list[0] ?? null;
  });
  protected readonly isAdminRole = computed(() => this.selected()?.name === ADMIN_ROLE_NAME);
  protected readonly catalogSize = computed(() => {
    const all = new Set(this.catalog.value() ?? []);
    for (const r of this.list()) r.permissions.forEach((p) => all.add(p));
    return all.size;
  });

  /** Unsaved selection for the selected role. */
  protected readonly draft = signal<string[]>([]);
  protected readonly dirty = computed(() => {
    const role = this.selected();
    return !!role && !sameSet(role.permissions, this.draft());
  });
  protected readonly changeCount = computed(() => {
    const before = new Set(this.selected()?.permissions ?? []);
    const after = new Set(this.draft());
    let n = 0;
    for (const p of after) if (!before.has(p)) n++;
    for (const p of before) if (!after.has(p)) n++;
    return n;
  });

  protected readonly saving = signal(false);
  protected readonly createOpen = signal(false);

  constructor() {
    // A different role (or freshly reloaded data) → start a clean draft.
    effect(() => {
      const role = this.selected();
      untracked(() => this.draft.set([...(role?.permissions ?? [])]));
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) event.preventDefault();
  }

  protected async selectRole(name: string): Promise<void> {
    if (name === this.selected()?.name) return;
    if (this.dirty() && !(await this.confirmDiscard())) return;
    this.url.patch({ role: name });
  }

  private confirmDiscard(): Promise<boolean> {
    return this.dialog.confirm({
      title: 'تجاهل التغييرات؟',
      message: `لديك ${this.changeCount()} تغيير غير محفوظ على صلاحيات «${roleLabel(this.selected()?.name ?? '')}». سيضيع إن انتقلت الآن.`,
      type: 'warning',
      confirmText: 'تجاهل التغييرات',
    });
  }

  protected discard(): void {
    this.draft.set([...(this.selected()?.permissions ?? [])]);
  }

  protected save(): void {
    const role = this.selected();
    if (!role || !this.dirty()) return;
    const permissions = [...this.draft()];
    this.saving.set(true);
    this.api.setPermissions(role.name, { permissions }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('تم حفظ صلاحيات الدور');
        // Show the saved state right away, then confirm with the server.
        this.roles.update((list) =>
          list?.map((r) => (r.name === role.name ? { ...r, permissions } : r)),
        );
        this.roles.reload();
        // Holders of this role see the change on their next profile refresh — refresh ours now.
        if (this.auth.currentUser()?.roles.includes(role.name)) {
          this.auth.refreshProfile().subscribe();
        }
      },
      error: () => this.saving.set(false),
    });
  }

  protected onCreated(name: string): void {
    this.createOpen.set(false);
    this.roles.reload();
    this.url.patch({ role: name });
  }

  protected async openCreate(): Promise<void> {
    if (this.dirty() && !(await this.confirmDiscard())) return;
    this.discard();
    this.createOpen.set(true);
  }

  protected async remove(role: RoleView): Promise<void> {
    if (role.builtIn) return;
    const users =
      role.userCount && role.userCount > 0
        ? ` يحمل هذا الدور ${role.userCount} مستخدم؛ سيفقدون صلاحياته فورًا.`
        : '';
    const ok = await this.dialog.confirm({
      title: 'حذف الدور؟',
      message: `سيُحذف الدور «${role.name}» نهائيًا.${users}`,
      type: 'danger',
      confirmText: 'حذف الدور',
    });
    if (!ok) return;
    this.api.delete(role.name).subscribe(() => {
      this.toast.success('تم حذف الدور');
      this.url.patch({ role: '' });
      this.roles.reload();
    });
  }
}
