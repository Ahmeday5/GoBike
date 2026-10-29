import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '@core/auth/services/auth.service';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { STAFF_ROLE } from '@core/constants/enums';
import { LookupService } from '@core/data/lookup.service';
import { createResource } from '@core/data/resource';
import { StaffUserDto } from '@core/models/domain.models';
import { injectUrlState } from '@core/routing/url-state';
import { DialogService } from '@core/services/dialog.service';
import { ToastService } from '@core/services/toast.service';
import {
  DataTableComponent,
  SortState,
  TableColumn,
} from '@shared/components/data-table/data-table.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { ChipComponent, EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { CairoDatePipe } from '@shared/pipes/format.pipes';
import { UsersApi } from '../../data-access/users.api';
import { injectRoleOptions } from '../../data-access/role-options';
import { USERS_QUERY_DEFAULTS, UsersQuery } from '../../models/user.models';
import { UserFormDialogComponent } from '../../components/user-form-dialog/user-form-dialog.component';
import { UserRolesDialogComponent } from '../../components/user-roles-dialog/user-roles-dialog.component';
import { UserPasswordDialogComponent } from '../../components/user-password-dialog/user-password-dialog.component';
import {
  StaffCredentials,
  UserCredentialsDialogComponent,
} from '../../components/user-credentials-dialog/user-credentials-dialog.component';

type Row = TemplateRef<{ $implicit: StaffUserDto }>;

const SORT_OPTIONS: readonly { value: UsersQuery['sortBy']; label: string }[] = [
  { value: '', label: 'الترتيب الافتراضي' },
  { value: 'name', label: 'الاسم' },
  { value: 'email', label: 'البريد الإلكتروني' },
  { value: 'createdAt', label: 'تاريخ الإضافة' },
  { value: 'lastLogin', label: 'آخر دخول' },
];

/** Settings → Users: dashboard staff accounts. Filters, sort and page live in the URL. */
@Component({
  selector: 'app-users',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTableComponent,
    PaginationComponent,
    PageHeaderComponent,
    SearchInputComponent,
    ChipComponent,
    EnumChipComponent,
    IconComponent,
    HasPermissionDirective,
    CairoDatePipe,
    UserFormDialogComponent,
    UserRolesDialogComponent,
    UserPasswordDialogComponent,
    UserCredentialsDialogComponent,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent {
  private readonly api = inject(UsersApi);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly lookups = inject(LookupService);

  protected readonly P = PERMISSIONS;
  protected readonly ROLE = STAFF_ROLE;
  protected readonly sortOptions = SORT_OPTIONS;

  protected readonly filters = injectUrlState<UsersQuery>(USERS_QUERY_DEFAULTS);
  protected readonly f = this.filters.state;

  protected readonly meId = computed(() => this.auth.currentUser()?.id ?? null);
  protected readonly canManage = computed(() => {
    this.auth.permissionSet();
    return this.auth.hasPermission(PERMISSIONS.Users.Manage);
  });
  protected readonly canPickOffice = computed(() => !!this.auth.currentUser()?.hasGlobalScope);
  protected readonly offices = toSignal(this.lookups.offices(), { initialValue: [] });
  protected readonly roleOptions = injectRoleOptions();

  protected readonly users = createResource(
    () => this.f(),
    (q) => this.api.list(q),
  );
  protected readonly rows = computed(() => this.users.value()?.data ?? []);
  protected readonly page = computed(() => this.users.value());

  protected readonly hasFilters = computed(() => {
    const f = this.f();
    return !!(f.search || f.role || f.officeId || f.isActive);
  });

  // ── dialogs ──
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<StaffUserDto | null>(null);
  protected readonly rolesFor = signal<StaffUserDto | null>(null);
  protected readonly passwordFor = signal<StaffUserDto | null>(null);
  protected readonly credentials = signal<StaffCredentials | null>(null);
  /** Row whose activate/deactivate/delete request is in flight. */
  protected readonly busyId = signal<string | null>(null);

  private readonly userTpl = viewChild<Row>('userTpl');
  private readonly phoneTpl = viewChild<Row>('phoneTpl');
  private readonly officeTpl = viewChild<Row>('officeTpl');
  private readonly rolesTpl = viewChild<Row>('rolesTpl');
  private readonly activeTpl = viewChild<Row>('activeTpl');
  private readonly loginTpl = viewChild<Row>('loginTpl');
  private readonly actionsTpl = viewChild<Row>('actionsTpl');

  protected readonly columns = computed<TableColumn<StaffUserDto>[]>(() => [
    {
      key: 'fullName',
      label: 'المستخدم',
      sortKey: 'name',
      align: 'start',
      cellTemplate: this.userTpl(),
    },
    { key: 'phoneNumber', label: 'الهاتف', cellTemplate: this.phoneTpl() },
    { key: 'officeName', label: 'المكتب', cellTemplate: this.officeTpl() },
    { key: 'roles', label: 'الأدوار', cellTemplate: this.rolesTpl() },
    { key: 'isActive', label: 'الحالة', cellTemplate: this.activeTpl() },
    {
      key: 'lastLoginAtUtc',
      label: 'آخر دخول',
      sortKey: 'lastLogin',
      cellTemplate: this.loginTpl(),
    },
    ...(this.canManage()
      ? [
          {
            key: 'actions',
            label: 'إجراءات',
            align: 'end' as const,
            cellTemplate: this.actionsTpl(),
          },
        ]
      : []),
  ]);

  protected select(field: keyof UsersQuery, event: Event): void {
    this.filters.patch({
      [field]: (event.target as HTMLSelectElement).value,
    } as Partial<UsersQuery>);
  }

  protected sort(s: SortState): void {
    this.filters.patch({ sortBy: s.sortBy as UsersQuery['sortBy'], sortDesc: s.sortDesc });
  }

  protected toggleSortDir(): void {
    this.filters.patch({ sortDesc: !this.f().sortDesc });
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(u: StaffUserDto): void {
    this.editing.set(u);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  protected onCreated(c: StaffCredentials): void {
    this.closeForm();
    this.credentials.set(c);
    this.users.reload();
  }

  protected onSaved(): void {
    this.closeForm();
    this.users.reload();
  }

  protected onRolesSaved(): void {
    this.rolesFor.set(null);
    this.users.reload();
  }

  protected onPasswordReset(c: StaffCredentials): void {
    this.passwordFor.set(null);
    this.credentials.set(c);
  }

  protected async toggleActive(u: StaffUserDto): Promise<void> {
    const activating = !u.isActive;
    const ok = await this.dialog.confirm(
      activating
        ? {
            title: 'تفعيل المستخدم؟',
            message: `سيتمكن ${u.fullName} من تسجيل الدخول إلى لوحة التحكم مرة أخرى بصلاحيات أدواره الحالية.`,
            type: 'info',
            confirmText: 'تفعيل',
          }
        : {
            title: 'إيقاف المستخدم؟',
            message: `لن يتمكن ${u.fullName} من تسجيل الدخول، وسيُسجَّل خروجه من كل الأجهزة. تبقى بياناته وسجلّه كما هي ويمكن إعادة تفعيله لاحقًا.`,
            type: 'warning',
            confirmText: 'إيقاف المستخدم',
          },
    );
    if (!ok) return;
    this.busyId.set(u.id);
    const request$ = activating ? this.api.activate(u.id) : this.api.deactivate(u.id);
    request$.subscribe({
      next: () => {
        this.busyId.set(null);
        this.lookups.invalidate();
        this.toast.success(activating ? 'تم تفعيل المستخدم' : 'تم إيقاف المستخدم');
        this.users.update((p) =>
          p
            ? {
                ...p,
                data: p.data.map((x) => (x.id === u.id ? { ...x, isActive: activating } : x)),
              }
            : p,
        );
      },
      error: () => this.busyId.set(null),
    });
  }

  protected async remove(u: StaffUserDto): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'حذف المستخدم نهائيًا؟',
      message:
        `سيُحذف حساب ${u.fullName} (${u.email}) ولا يمكن التراجع. ` +
        'يُفضَّل «إيقاف» المستخدم بدلًا من الحذف للحفاظ على سجل عملياته. ' +
        'لا يمكن حذف آخر مستخدم بدور الأدمن.',
      type: 'danger',
      confirmText: 'حذف نهائي',
    });
    if (!ok) return;
    this.busyId.set(u.id);
    this.api.delete(u.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.lookups.invalidate();
        this.toast.success('تم حذف المستخدم');
        this.users.reload();
      },
      error: () => this.busyId.set(null),
    });
  }
}
