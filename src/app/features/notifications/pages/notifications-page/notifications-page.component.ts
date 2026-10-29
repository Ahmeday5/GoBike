import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NOTIFICATION_SEVERITY,
  NOTIFICATION_TYPE,
  enumMeta,
  enumOptions,
} from '@core/constants/enums';
import { createResource } from '@core/data/resource';
import {
  NotificationCenterService,
  notificationLink,
} from '@core/notifications/notification-center.service';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { AppNotification } from '@core/realtime/realtime.models';
import { injectUrlState } from '@core/routing/url-state';
import { ToastService } from '@core/services/toast.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { ChipComponent, EnumChipComponent } from '@shared/components/chip/chip.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CairoDatePipe } from '@shared/pipes/format.pipes';
import {
  NOTIFICATIONS_QUERY_DEFAULTS,
  NotificationsPageQuery,
} from '../../models/notifications.models';

const SKELETONS = Array.from({ length: 6 }, (_, i) => i);

/**
 * 5.12 — Full notifications inbox (the bell shows only the latest few).
 * Filters and page live in the URL. Live notifications are prepended while
 * the unfiltered first page is shown; otherwise a "new — refresh" pill appears
 * so the list never jumps under the user.
 */
@Component({
  selector: 'app-notifications-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    PaginationComponent,
    ChipComponent,
    EnumChipComponent,
    EmptyStateComponent,
    IconComponent,
    CairoDatePipe,
  ],
  templateUrl: './notifications-page.component.html',
  styleUrl: './notifications-page.component.scss',
})
export class NotificationsPageComponent {
  protected readonly center = inject(NotificationCenterService);
  private readonly hub = inject(DashboardHubService);
  private readonly toast = inject(ToastService);

  protected readonly SEVERITY = NOTIFICATION_SEVERITY;
  protected readonly TYPE = NOTIFICATION_TYPE;
  protected readonly severityOptions = enumOptions(NOTIFICATION_SEVERITY);
  protected readonly typeOptions = enumOptions(NOTIFICATION_TYPE);
  protected readonly skeletons = SKELETONS;

  protected readonly filters = injectUrlState<NotificationsPageQuery>(NOTIFICATIONS_QUERY_DEFAULTS);
  protected readonly f = this.filters.state;

  protected readonly res = createResource(
    () => this.f(),
    (q) => this.center.list(q),
    { refetchOn: this.hub.reconnected$ },
  );
  protected readonly rows = computed(() => this.res.value()?.data ?? []);
  protected readonly page = computed(() => this.res.value());

  protected readonly hasFilters = computed(() => {
    const f = this.f();
    return !!(f.unreadOnly || f.severity || f.type);
  });
  /** Live items can be prepended only to the unfiltered first page. */
  private readonly isLiveView = computed(() => !this.hasFilters() && this.f().pageIndex === 1);

  /** Live notifications that arrived while a filtered/later page was shown. */
  protected readonly newCount = signal(0);
  protected readonly busyId = signal<string | null>(null);
  protected readonly markingAll = signal(false);
  protected readonly hasUnread = computed(
    () => this.center.unreadCount() > 0 || this.rows().some((n) => !n.isRead),
  );

  constructor() {
    // A new filter/page shows fresh data — the pending pill no longer applies.
    effect(() => {
      this.f();
      untracked(() => this.newCount.set(0));
    });

    this.hub.notification$.pipe(takeUntilDestroyed()).subscribe((n) => this.onLive(n));
    this.hub.reconnected$.pipe(takeUntilDestroyed()).subscribe(() => this.newCount.set(0));
  }

  protected severity(n: AppNotification) {
    return enumMeta(NOTIFICATION_SEVERITY, n.severity);
  }

  protected hasLink(n: AppNotification): boolean {
    return !!notificationLink(n);
  }

  protected needsAck(n: AppNotification): boolean {
    return !!n.requiresAcknowledgement && !n.acknowledgedAtUtc;
  }

  protected select(field: 'severity' | 'type', event: Event): void {
    this.filters.patch({
      [field]: (event.target as HTMLSelectElement).value,
    } as Partial<NotificationsPageQuery>);
  }

  protected toggleUnread(event: Event): void {
    this.filters.patch({ unreadOnly: (event.target as HTMLInputElement).checked });
  }

  /** Marks read (server + locally) and follows the deep link, if any. */
  protected open(n: AppNotification): void {
    this.center.open(n);
    this.patch(n.id, { isRead: true });
  }

  protected acknowledge(n: AppNotification): void {
    this.busyId.set(n.id);
    this.center.acknowledge(n).subscribe({
      next: () => {
        this.busyId.set(null);
        this.patch(n.id, { acknowledgedAtUtc: new Date().toISOString() });
        this.toast.success('تم تأكيد الاستلام');
      },
      error: () => this.busyId.set(null),
    });
  }

  protected markAllRead(): void {
    this.markingAll.set(true);
    this.center.markAllRead().subscribe({
      next: () => {
        this.markingAll.set(false);
        if (this.f().unreadOnly) this.res.reload();
        else
          this.res.update((p) => p && { ...p, data: p.data.map((n) => ({ ...n, isRead: true })) });
      },
      error: () => this.markingAll.set(false),
    });
  }

  /** "New notifications — refresh": back to the live view's data. */
  protected refresh(): void {
    this.newCount.set(0);
    if (this.f().pageIndex !== 1) this.filters.patch({ pageIndex: 1 });
    else this.res.reload();
  }

  private onLive(n: AppNotification): void {
    if (!this.isLiveView() || !this.res.value()) {
      this.newCount.update((c) => c + 1);
      return;
    }
    const pageSize = this.f().pageSize;
    this.res.update((p) => {
      if (!p) return p;
      const exists = p.data.some((x) => x.id === n.id);
      const data = [n, ...p.data.filter((x) => x.id !== n.id)].slice(0, pageSize);
      const count = exists ? p.count : p.count + 1;
      return { ...p, data, count, totalPages: Math.max(1, Math.ceil(count / pageSize)) };
    });
  }

  private patch(id: string, changes: Partial<AppNotification>): void {
    this.res.update(
      (p) => p && { ...p, data: p.data.map((n) => (n.id === id ? { ...n, ...changes } : n)) },
    );
  }
}
