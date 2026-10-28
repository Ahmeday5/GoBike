import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/services/auth.service';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { APP_ROUTES } from '@core/constants/app-routes';
import { DRIVER_STATUS } from '@core/constants/enums';
import { createResource } from '@core/data/resource';
import { DriverCredentials } from '@core/models/domain.models';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { injectUrlState } from '@core/routing/url-state';
import { DialogService } from '@core/services/dialog.service';
import { ToastService } from '@core/services/toast.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ChipComponent, EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { TabItem, TabsComponent } from '@shared/components/tabs/tabs.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { DocumentsPanelComponent } from '@shared/components/documents-panel/documents-panel.component';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { CairoDatePipe } from '@shared/pipes/format.pipes';
import { DriversApi } from '../../data-access/drivers.api';
import { DriverTab } from '../../models/driver.models';
import { DriverFormDialogComponent } from '../../components/driver-form-dialog/driver-form-dialog.component';
import { DriverStatusDialogComponent } from '../../components/driver-status-dialog/driver-status-dialog.component';
import {
  DriverPasswordDialogComponent,
  PasswordDialogMode,
} from '../../components/driver-password-dialog/driver-password-dialog.component';
import { CredentialsDialogComponent } from '../../components/credentials-dialog/credentials-dialog.component';
import { LicenseExpiryComponent } from '../../components/license-expiry/license-expiry.component';
import { DriverRentalsTabComponent } from '../../components/driver-rentals-tab/driver-rentals-tab.component';
import { DriverOilTabComponent } from '../../components/driver-oil-tab/driver-oil-tab.component';
import { DriverAccountTabComponent } from '../../components/driver-account/driver-account-tab.component';

const TAB_DEFS: (TabItem & { id: DriverTab; permission: string })[] = [
  { id: 'info', label: 'البيانات', icon: 'user', permission: PERMISSIONS.Drivers.Read },
  { id: 'rentals', label: 'الإيجارات', icon: 'route', permission: PERMISSIONS.Drivers.Read },
  { id: 'documents', label: 'المستندات', icon: 'file', permission: PERMISSIONS.Documents.Read },
  {
    id: 'account',
    label: 'الحساب والمديونية',
    icon: 'cash',
    permission: PERMISSIONS.DriverLedger.Read,
  },
  { id: 'oil', label: 'فيديوهات الزيت', icon: 'droplet', permission: PERMISSIONS.Drivers.Read },
];

/**
 * 5.5 — Driver page. Ledger-only users (driver_ledger.read without
 * drivers.read) still get the account tab: the profile request is skipped
 * (or its 403 tolerated) and the header degrades to a generic title.
 */
@Component({
  selector: 'app-driver-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    ChipComponent,
    EnumChipComponent,
    IconComponent,
    TabsComponent,
    EmptyStateComponent,
    DocumentsPanelComponent,
    HasPermissionDirective,
    CairoDatePipe,
    DriverFormDialogComponent,
    DriverStatusDialogComponent,
    DriverPasswordDialogComponent,
    CredentialsDialogComponent,
    LicenseExpiryComponent,
    DriverRentalsTabComponent,
    DriverOilTabComponent,
    DriverAccountTabComponent,
  ],
  templateUrl: './driver-detail.component.html',
  styleUrl: './driver-detail.component.scss',
})
export class DriverDetailComponent {
  private readonly api = inject(DriversApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  /** Route param (component input binding). */
  readonly id = input.required<string>();

  protected readonly P = PERMISSIONS;
  protected readonly STATUS = DRIVER_STATUS;
  protected readonly listLink = APP_ROUTES.drivers;

  protected readonly canReadDriver = computed(() =>
    this.auth.hasPermission(PERMISSIONS.Drivers.Read),
  );

  protected readonly driverRes = createResource(
    () => (this.canReadDriver() ? this.id() : null),
    (id) => this.api.get(id),
    { refetchOn: inject(DashboardHubService).reconnected$ },
  );
  protected readonly driver = computed(() => this.driverRes.value() ?? null);
  /** 404 (or another office) → not-found state; 403 just hides the profile. */
  protected readonly notFound = computed(() => this.driverRes.error()?.status === 404);
  protected readonly loadFailed = computed(() => {
    const s = this.driverRes.error()?.status;
    return !!s && s !== 404 && s !== 403;
  });

  private readonly tabState = injectUrlState({ tab: '' });
  protected readonly tabs = computed<TabItem[]>(() =>
    TAB_DEFS.filter((t) => this.auth.hasPermission(t.permission)).map(
      ({ id, label, icon }) => ({ id, label, icon }),
    ),
  );
  protected readonly activeTab = computed<DriverTab>(() => {
    const wanted = this.tabState.state().tab;
    const allowed = this.tabs();
    return (allowed.find((t) => t.id === wanted)?.id ?? allowed[0]?.id ?? 'info') as DriverTab;
  });

  // ── dialogs ──
  protected readonly editOpen = signal(false);
  protected readonly statusOpen = signal(false);
  protected readonly passwordMode = signal<PasswordDialogMode | null>(null);
  protected readonly credentials = signal<DriverCredentials | null>(null);
  protected readonly credentialsTitle = signal('');

  protected setTab(tab: string): void {
    this.tabState.patch({ tab });
  }

  protected onSaved(): void {
    this.editOpen.set(false);
    this.statusOpen.set(false);
    this.driverRes.reload();
  }

  protected async resetPassword(): Promise<void> {
    const d = this.driver();
    if (!d) return;
    const ok = await this.dialog.confirm({
      title: 'تعيين كلمة مرور جديدة؟',
      message: `ستتوقف كلمة المرور الحالية لـ ${d.fullName} عن العمل فورًا، وسيُسجَّل خروجه من التطبيق على كل الأجهزة. ستظهر لك كلمة المرور الجديدة مرة واحدة فقط.`,
      type: 'warning',
      confirmText: 'متابعة',
    });
    if (ok) this.passwordMode.set('reset');
  }

  protected onCredentials(c: DriverCredentials): void {
    this.credentialsTitle.set(
      this.passwordMode() === 'account' ? 'تم إنشاء حساب التطبيق' : 'كلمة المرور الجديدة',
    );
    this.passwordMode.set(null);
    this.credentials.set(c);
    this.driverRes.reload();
  }

  protected async remove(): Promise<void> {
    const d = this.driver();
    if (!d) return;
    const ok = await this.dialog.confirm({
      title: 'حذف السائق؟',
      message: `سيُحذف ملف ${d.fullName} ويتوقف دخوله إلى التطبيق. لا يمكن التراجع عن هذا الإجراء.`,
      type: 'danger',
      confirmText: 'حذف السائق',
    });
    if (!ok) return;
    this.api.delete(d.id).subscribe(() => {
      this.toast.success('تم حذف السائق');
      void this.router.navigateByUrl(APP_ROUTES.drivers);
    });
  }
}
