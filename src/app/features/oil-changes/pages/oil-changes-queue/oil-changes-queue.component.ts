import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { merge } from 'rxjs';
import { AuthService } from '@core/auth/services/auth.service';
import { LookupService } from '@core/data/lookup.service';
import { createResource } from '@core/data/resource';
import { injectUrlState } from '@core/routing/url-state';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { APP_ROUTES } from '@core/constants/app-routes';
import { OIL_CHANGE_STATUS, OilChangeSubmissionStatus } from '@core/constants/enums';
import { OilChangeSubmissionDto } from '@core/models/domain.models';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { TabItem, TabsComponent } from '@shared/components/tabs/tabs.component';
import { ChipComponent, EnumChipComponent } from '@shared/components/chip/chip.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { FORMAT_PIPES } from '@shared/pipes/format.pipes';
import { OilChangesApi } from '../../data-access/oil-changes.api';
import {
  DEFAULT_OIL_THRESHOLDS,
  OIL_CHANGES_QUERY_DEFAULTS,
  OilChangesQuery,
  oilLevelClass,
} from '../../models/oil-change.models';

const STATUS_TABS: OilChangeSubmissionStatus[] = ['Pending', 'Approved', 'Rejected', 'Expired'];
const SKELETON_CARDS = Array.from({ length: 6 }, (_, i) => i);

/** 5.8 — Oil-change videos queue. Status tab, office, deep-link filters and page live in the URL. */
@Component({
  selector: 'app-oil-changes-queue',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    PaginationComponent,
    TabsComponent,
    ChipComponent,
    EnumChipComponent,
    EmptyStateComponent,
    IconComponent,
    ...FORMAT_PIPES,
  ],
  templateUrl: './oil-changes-queue.component.html',
  styleUrl: './oil-changes-queue.component.scss',
})
export class OilChangesQueueComponent {
  private readonly api = inject(OilChangesApi);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly hub = inject(DashboardHubService);

  protected readonly STATUS = OIL_CHANGE_STATUS;
  protected readonly skeletons = SKELETON_CARDS;
  protected readonly levelClass = oilLevelClass;

  protected readonly filters = injectUrlState<OilChangesQuery>(OIL_CHANGES_QUERY_DEFAULTS);
  protected readonly f = this.filters.state;

  protected readonly canPickOffice = computed(() => !!this.auth.currentUser()?.hasGlobalScope);
  protected readonly offices = toSignal(inject(LookupService).offices(), { initialValue: [] });

  /** New uploads arrive as hub notifications — refresh the queue when one does. */
  private readonly refetch$ = merge(this.hub.reconnected$, this.hub.notification$);

  protected readonly submissions = createResource(
    () => this.f(),
    (q) => this.api.list(q),
    { refetchOn: this.refetch$ },
  );
  protected readonly rows = computed(() => this.submissions.value()?.data ?? []);
  protected readonly page = computed(() => this.submissions.value());

  /** Pending count for the tab badge, scoped like the list (office / bike / driver). */
  private readonly pending = createResource(
    () => {
      const { officeId, motorcycleId, driverId } = this.f();
      return { status: 'Pending' as const, officeId, motorcycleId, driverId, pageSize: 1 };
    },
    (q) => this.api.list(q),
    { refetchOn: this.refetch$ },
  );
  protected readonly pendingCount = computed(() => this.pending.value()?.count ?? 0);

  protected readonly tabs = computed<TabItem[]>(() =>
    STATUS_TABS.map((s) => ({
      id: s,
      label: OIL_CHANGE_STATUS[s].label,
      icon: OIL_CHANGE_STATUS[s].icon,
      badge: s === 'Pending' ? this.pendingCount() : null,
    })),
  );

  protected readonly hasScopeFilters = computed(() => {
    const f = this.f();
    return !!(f.motorcycleId || f.driverId);
  });

  /** Plate / driver name for the "filtered by" chip, taken from the loaded rows. */
  protected readonly scopeLabel = computed(() => {
    const f = this.f();
    const first = this.rows()[0];
    if (f.motorcycleId) return `الموتوسيكل ${first?.plateNumber ?? ''}`.trim();
    if (f.driverId) return `السائق ${first?.driverName ?? ''}`.trim();
    return '';
  });

  protected readonly emptyText = computed(() => {
    switch (this.f().status) {
      case 'Pending':
        return 'لا توجد فيديوهات بانتظار المراجعة الآن. ستظهر هنا فور رفع السائقين لها.';
      case 'Expired':
        return 'الفيديو تنتهي مهلته إذا لم يراجعه أحد خلال 7 أيام.';
      default:
        return 'جرّب تبويبًا أو مكتبًا آخر.';
    }
  });

  protected setStatus(status: string): void {
    this.filters.patch({ status: status as OilChangeSubmissionStatus });
  }

  protected selectOffice(event: Event): void {
    this.filters.patch({ officeId: (event.target as HTMLSelectElement).value });
  }

  protected clearScope(): void {
    this.filters.patch({ motorcycleId: '', driverId: '' });
  }

  protected open(s: OilChangeSubmissionDto): void {
    // The review page returns here (same filters) after a decision.
    void this.router.navigateByUrl(APP_ROUTES.oilChange(s.id), {
      state: { queueUrl: this.router.url },
    });
  }

  protected overMax(s: OilChangeSubmissionDto): boolean {
    return (s.kmAtSubmit ?? 0) > DEFAULT_OIL_THRESHOLDS.maxKm;
  }
}
