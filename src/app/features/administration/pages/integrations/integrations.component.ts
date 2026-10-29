import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { injectUrlState } from '@core/routing/url-state';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { TabItem, TabsComponent } from '@shared/components/tabs/tabs.component';
import {
  INTEGRATIONS_PAGE_DEFAULTS,
  IntegrationsPageQuery,
  IntegrationsTab,
} from '../../models/integration.models';
import { GpsHealthPanelComponent } from '../../components/gps-health-panel/gps-health-panel.component';
import { SyncLogsTabComponent } from '../../components/sync-logs-tab/sync-logs-tab.component';
import { DeliveriesTabComponent } from '../../components/deliveries-tab/deliveries-tab.component';

const TABS: readonly TabItem[] = [
  { id: 'health', label: 'صحة مزود التتبع', icon: 'pulse' },
  { id: 'sync', label: 'سجل المزامنة', icon: 'refresh' },
  { id: 'deliveries', label: 'إرسال الإشعارات', icon: 'send' },
];
const TAB_IDS = TABS.map((t) => t.id);

/** Settings → Integrations health (read-only). The active tab lives in `?tab=`. */
@Component({
  selector: 'app-integrations',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    TabsComponent,
    GpsHealthPanelComponent,
    SyncLogsTabComponent,
    DeliveriesTabComponent,
  ],
  template: `
    <app-page-header
      title="حالة التكاملات"
      subtitle="صحة مزود GPS، سجل المزامنة، ونتائج إرسال الإشعارات"
    />
    <app-tabs [tabs]="tabs" [active]="tab()" (activeChange)="selectTab($event)" />
    @switch (tab()) {
      @case ('sync') {
        <app-sync-logs-tab />
      }
      @case ('deliveries') {
        <app-deliveries-tab />
      }
      @default {
        <app-gps-health-panel />
      }
    }
  `,
})
export class IntegrationsComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly tabs = TABS;
  private readonly url = injectUrlState<IntegrationsPageQuery>(INTEGRATIONS_PAGE_DEFAULTS);
  protected readonly tab = computed<IntegrationsTab>(() => {
    const t = this.url.state().tab;
    return TAB_IDS.includes(t) ? t : 'health';
  });

  /**
   * Each tab owns its filter keys (and both use pageIndex/pageSize), so a tab
   * switch starts from a clean query string instead of carrying page 3 over.
   */
  protected selectTab(id: string): void {
    if (id === this.tab()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: id === INTEGRATIONS_PAGE_DEFAULTS.tab ? {} : { tab: id },
      replaceUrl: true,
    });
  }
}
