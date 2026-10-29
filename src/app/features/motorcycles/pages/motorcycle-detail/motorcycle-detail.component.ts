import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { filter, merge } from 'rxjs';
import { AuthService } from '@core/auth/services/auth.service';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { APP_ROUTES } from '@core/constants/app-routes';
import { GPS_CONNECTIVITY, MOTORCYCLE_HEALTH, MOTORCYCLE_STATUS } from '@core/constants/enums';
import { createResource } from '@core/data/resource';
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
import { CairoDatePipe, KmPipe } from '@shared/pipes/format.pipes';
import { MotorcyclesApi } from '../../data-access/motorcycles.api';
import { MotorcycleTab } from '../../models/motorcycle-overview.models';
import { MotorcycleFormDialogComponent } from '../../components/motorcycle-form-dialog/motorcycle-form-dialog.component';
import { MotorcycleStatusDialogComponent } from '../../components/motorcycle-status-dialog/motorcycle-status-dialog.component';
import { MotorcycleTransferDialogComponent } from '../../components/motorcycle-transfer-dialog/motorcycle-transfer-dialog.component';
import { OilBaselineDialogComponent } from '../../components/oil-baseline-dialog/oil-baseline-dialog.component';
import { MotorcycleOverviewTabComponent } from '../../components/motorcycle-overview-tab/motorcycle-overview-tab.component';
import { MotorcycleRouteTabComponent } from '../../components/motorcycle-route-tab/motorcycle-route-tab.component';
import { MotorcycleAlarmsTabComponent } from '../../components/motorcycle-alarms-tab/motorcycle-alarms-tab.component';
import { MotorcycleMaintenanceTabComponent } from '../../components/motorcycle-maintenance-tab/motorcycle-maintenance-tab.component';
import { MotorcycleRentalsTabComponent } from '../../components/motorcycle-rentals-tab/motorcycle-rentals-tab.component';
import { MotorcycleStatusHistoryTabComponent } from '../../components/motorcycle-history-tabs/motorcycle-status-history-tab.component';
import { MotorcycleTransfersTabComponent } from '../../components/motorcycle-history-tabs/motorcycle-transfers-tab.component';
import { MotorcycleMileageTabComponent } from '../../components/motorcycle-mileage-tab/motorcycle-mileage-tab.component';

const TAB_DEFS: (TabItem & { id: MotorcycleTab; permission: string })[] = [
  { id: 'overview', label: 'نظرة عامة', icon: 'grid', permission: PERMISSIONS.Motorcycles.Read },
  { id: 'route', label: 'المسار', icon: 'route', permission: PERMISSIONS.Gps.History },
  { id: 'alarms', label: 'إنذارات الجهاز', icon: 'bell', permission: PERMISSIONS.Gps.History },
  {
    id: 'maintenance',
    label: 'الصيانة',
    icon: 'wrench',
    permission: PERMISSIONS.Maintenance.Read,
  },
  { id: 'rentals', label: 'الإيجارات', icon: 'users', permission: PERMISSIONS.Assignments.Read },
  { id: 'status', label: 'سجل الحالات', icon: 'clock', permission: PERMISSIONS.Motorcycles.Read },
  { id: 'transfers', label: 'النقل', icon: 'building', permission: PERMISSIONS.Motorcycles.Read },
  { id: 'documents', label: 'المستندات', icon: 'file', permission: PERMISSIONS.Documents.Read },
  { id: 'mileage', label: 'الكيلومترات', icon: 'chart', permission: PERMISSIONS.Motorcycles.Read },
];

/**
 * 5.2 — Motorcycle page. One overview call feeds the header and the
 * overview tab; it's refetched after a hub reconnect and whenever the hub
 * reports a health change for this bike. Other tabs load their own data
 * when opened. Tab in `?tab=`, filtered by permission.
 */
@Component({
  selector: 'app-motorcycle-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageHeaderComponent,
    ChipComponent,
    EnumChipComponent,
    IconComponent,
    TabsComponent,
    EmptyStateComponent,
    DocumentsPanelComponent,
    HasPermissionDirective,
    CairoDatePipe,
    KmPipe,
    MotorcycleFormDialogComponent,
    MotorcycleStatusDialogComponent,
    MotorcycleTransferDialogComponent,
    OilBaselineDialogComponent,
    MotorcycleOverviewTabComponent,
    MotorcycleRouteTabComponent,
    MotorcycleAlarmsTabComponent,
    MotorcycleMaintenanceTabComponent,
    MotorcycleRentalsTabComponent,
    MotorcycleStatusHistoryTabComponent,
    MotorcycleTransfersTabComponent,
    MotorcycleMileageTabComponent,
  ],
  templateUrl: './motorcycle-detail.component.html',
  styleUrl: './motorcycle-detail.component.scss',
})
export class MotorcycleDetailComponent {
  private readonly api = inject(MotorcyclesApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly hub = inject(DashboardHubService);

  /** Route param (component input binding). */
  readonly id = input.required<string>();

  protected readonly P = PERMISSIONS;
  protected readonly R = APP_ROUTES;
  protected readonly STATUS = MOTORCYCLE_STATUS;
  protected readonly HEALTH = MOTORCYCLE_HEALTH;
  protected readonly CONNECTIVITY = GPS_CONNECTIVITY;
  protected readonly listLink = APP_ROUTES.motorcycles;

  protected readonly overviewRes = createResource(
    () => this.id(),
    (id) => this.api.overview(id),
    {
      refetchOn: merge(
        this.hub.reconnected$,
        this.hub.motorcycleHealthChanged$.pipe(filter((e) => e?.motorcycleId === this.id())),
      ),
    },
  );
  protected readonly overview = computed(() => this.overviewRes.value() ?? null);
  protected readonly motorcycle = computed(() => this.overview()?.motorcycle ?? null);
  /** 404 (deleted or another office) → not-found state. */
  protected readonly notFound = computed(() => this.overviewRes.error()?.status === 404);
  protected readonly loadFailed = computed(() => {
    const s = this.overviewRes.error()?.status;
    return !!s && s !== 404;
  });

  protected readonly health = computed(
    () => this.overview()?.health ?? this.motorcycle()?.health ?? null,
  );
  protected readonly lastSeen = computed(() => {
    const l = this.overview()?.location;
    return l?.lastGpsAtUtc ?? l?.recordedAtUtc ?? null;
  });
  protected readonly canChangeStatus = computed(
    () => (this.motorcycle()?.allowedStatusChanges?.length ?? 0) > 0,
  );

  private readonly tabState = injectUrlState({ tab: '' });
  protected readonly tabs = computed<TabItem[]>(() => {
    const o = this.overview();
    const open = (o?.openAlerts?.length ?? 0) + (o?.openIncidents?.length ?? 0);
    return TAB_DEFS.filter((t) => this.auth.hasPermission(t.permission)).map(
      ({ id, label, icon }) => ({ id, label, icon, badge: id === 'overview' ? open : null }),
    );
  });
  protected readonly activeTab = computed<MotorcycleTab>(() => {
    const wanted = this.tabState.state().tab;
    const allowed = this.tabs();
    return (allowed.find((t) => t.id === wanted)?.id ??
      allowed[0]?.id ??
      'overview') as MotorcycleTab;
  });

  // ── dialogs ──
  protected readonly editOpen = signal(false);
  protected readonly statusOpen = signal(false);
  protected readonly transferOpen = signal(false);
  protected readonly baselineOpen = signal(false);

  protected setTab(tab: string): void {
    this.tabState.patch({ tab });
  }

  protected onSaved(): void {
    this.editOpen.set(false);
    this.statusOpen.set(false);
    this.transferOpen.set(false);
    this.baselineOpen.set(false);
    this.overviewRes.reload();
  }

  /** 409 on edit: the dialog already told the user; close it and load fresh data. */
  protected onConflict(): void {
    this.editOpen.set(false);
    this.overviewRes.reload();
  }

  protected async remove(): Promise<void> {
    const m = this.motorcycle();
    if (!m) return;
    const rented = !!this.overview()?.currentRental;
    const ok = await this.dialog.confirm({
      title: 'حذف الموتوسيكل؟',
      message:
        `سيُحذف الموتوسيكل ${m.plateNumber} من الأسطول ويختفي من القوائم والخريطة. ` +
        (rented ? 'تنبيه: الموتوسيكل مؤجَّر حاليًا. ' : '') +
        'يبقى سجله التاريخي محفوظًا في النظام.',
      type: 'danger',
      confirmText: 'حذف الموتوسيكل',
    });
    if (!ok) return;
    this.api.delete(m.id).subscribe(() => {
      this.toast.success('تم حذف الموتوسيكل');
      void this.router.navigateByUrl(APP_ROUTES.motorcycles);
    });
  }
}
