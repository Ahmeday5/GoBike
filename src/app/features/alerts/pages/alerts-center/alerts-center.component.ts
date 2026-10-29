import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, merge } from 'rxjs';
import { AuthService } from '@core/auth/services/auth.service';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { createResource } from '@core/data/resource';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { injectUrlState } from '@core/routing/url-state';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { TabItem, TabsComponent } from '@shared/components/tabs/tabs.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { NumberPipe } from '@shared/pipes/format.pipes';
import { AlertsApi } from '../../data-access/alerts.api';
import {
  AlertsCenterQuery,
  AlertsTab,
  isIncidentNotification,
  isOilNotification,
} from '../../models/alerts.models';
import { OilAlertsTabComponent } from '../../components/oil-alerts-tab/oil-alerts-tab.component';
import { IncidentsTabComponent } from '../../components/incidents-tab/incidents-tab.component';

const TAB_DEFS: (TabItem & { id: AlertsTab; permission: string })[] = [
  { id: 'oil', label: 'تنبيهات الزيت', icon: 'droplet', permission: PERMISSIONS.Alerts.Read },
  { id: 'gps', label: 'التتبع والكهرباء', icon: 'power', permission: PERMISSIONS.Incidents.Read },
  { id: 'zone', label: 'الخروج من النطاق', icon: 'target', permission: PERMISSIONS.Incidents.Read },
];

/**
 * 5.9 — Alerts center: oil alerts, GPS/power incidents and zone exits in one
 * page. The active tab lives in `?tab=`; each tab owns its filters in the URL
 * too, and switching tab clears them (oil and incident filters share names
 * like `status`/`officeId` but not their values).
 */
@Component({
  selector: 'app-alerts-center',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    TabsComponent,
    IconComponent,
    NumberPipe,
    OilAlertsTabComponent,
    IncidentsTabComponent,
  ],
  templateUrl: './alerts-center.component.html',
  styleUrl: './alerts-center.component.scss',
})
export class AlertsCenterComponent {
  private readonly api = inject(AlertsApi);
  private readonly auth = inject(AuthService);
  private readonly hub = inject(DashboardHubService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly tabState = injectUrlState<AlertsCenterQuery>({ tab: '' });

  protected readonly canOil = computed(() => this.auth.hasPermission(PERMISSIONS.Alerts.Read));
  protected readonly canIncidents = computed(() =>
    this.auth.hasPermission(PERMISSIONS.Incidents.Read),
  );

  // ── counters (pageSize=1, read `count`) — refreshed live by relevant hub notifications ──
  private readonly oilRefetch$ = merge(
    this.hub.reconnected$,
    this.hub.notification$.pipe(filter(isOilNotification)),
  );
  private readonly incidentRefetch$ = merge(
    this.hub.reconnected$,
    this.hub.notification$.pipe(filter(isIncidentNotification)),
  );

  private readonly oilCountRes = createResource(
    () => (this.canOil() ? { openOnly: true, pageIndex: 1, pageSize: 1 } : null),
    (p) => this.api.oilAlerts(p, true),
    { refetchOn: this.oilRefetch$ },
  );
  /** Every unresolved incident, zone included (the API filters by one type at most). */
  private readonly incidentCountRes = createResource(
    () => (this.canIncidents() ? { unresolvedOnly: true, pageIndex: 1, pageSize: 1 } : null),
    (p) => this.api.incidents(p, true),
    { refetchOn: this.incidentRefetch$ },
  );
  private readonly zoneCountRes = createResource(
    () =>
      this.canIncidents()
        ? { unresolvedOnly: true, type: 'OutOfZone' as const, pageIndex: 1, pageSize: 1 }
        : null,
    (p) => this.api.incidents(p, true),
    { refetchOn: this.incidentRefetch$ },
  );

  protected readonly oilCount = computed(() => this.oilCountRes.value()?.count ?? null);
  protected readonly zoneCount = computed(() => this.zoneCountRes.value()?.count ?? null);
  /** GPS & power = all unresolved incidents minus the zone ones. */
  protected readonly gpsCount = computed(() => {
    const all = this.incidentCountRes.value()?.count;
    const zone = this.zoneCount();
    return all == null || zone == null ? null : Math.max(0, all - zone);
  });

  protected readonly tabs = computed<TabItem[]>(() => {
    const badges: Record<AlertsTab, number | null> = {
      oil: this.oilCount(),
      gps: this.gpsCount(),
      zone: this.zoneCount(),
    };
    return TAB_DEFS.filter((t) => this.auth.hasPermission(t.permission)).map(
      ({ id, label, icon }) => ({ id, label, icon, badge: badges[id] }),
    );
  });

  protected readonly activeTab = computed<AlertsTab>(() => {
    const wanted = this.tabState.state().tab;
    const allowed = this.tabs();
    return (allowed.find((t) => t.id === wanted)?.id ?? allowed[0]?.id ?? 'oil') as AlertsTab;
  });

  /** Switching tab drops the previous tab's filters (only `?tab=` survives). */
  protected setTab(tab: string): void {
    if (tab === this.activeTab()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      replaceUrl: true,
    });
  }

  /** A tab acknowledged/resolved something — counters may have moved. */
  protected refreshCounters(): void {
    this.oilCountRes.reload();
    this.incidentCountRes.reload();
    this.zoneCountRes.reload();
  }
}
