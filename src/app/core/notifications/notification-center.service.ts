import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable, catchError, map, merge, of, tap } from 'rxjs';
import { ApiService } from '../services/api.service';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../auth/services/auth.service';
import { DashboardHubService } from '../realtime/dashboard-hub.service';
import { AppNotification } from '../realtime/realtime.models';
import { PagedResponse } from '../models/api-response.model';
import { NotificationSeverity, NotificationType } from '../constants/enums';
import { APP_ROUTES } from '../constants/app-routes';
import { withSilentErrors, withSkipLoader } from '../http/http-context.tokens';
import { toPaged } from '../utils/api-list.util';

export interface NotificationsQuery {
  pageIndex: number;
  pageSize: number;
  unreadOnly?: boolean;
  type?: NotificationType | '';
  severity?: NotificationSeverity | '';
  pendingAcknowledgementOnly?: boolean;
}

const ENDPOINTS = {
  list: 'notifications',
  unreadCount: 'notifications/unread-count',
  read: (id: string) => `notifications/${id}/read`,
  readAll: 'notifications/read-all',
  acknowledge: (id: string) => `notifications/${id}/acknowledge`,
} as const;

/** How many recent notifications the bell dropdown keeps in memory. */
const RECENT_LIMIT = 8;

/**
 * Bell badge + live notifications.
 *
 *   - unread count loaded on sign-in, re-synced after a hub reconnect
 *   - each hub `notification` bumps the count, joins `recent`, and shows a
 *     toast (Critical → sticky, with a "عرض" action that deep-links)
 */
@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly hub = inject(DashboardHubService);

  readonly unreadCount = signal(0);
  readonly recent = signal<AppNotification[]>([]);

  constructor() {
    effect(() => {
      const signedIn = this.auth.isAuthenticated();
      untracked(() => {
        if (signedIn) this.sync();
        else {
          this.unreadCount.set(0);
          this.recent.set([]);
        }
      });
    });

    merge(
      this.hub.reconnected$.pipe(tap(() => this.sync())),
      this.hub.notification$.pipe(tap((n) => this.onLive(n))),
    )
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe();
  }

  list(query: NotificationsQuery): Observable<PagedResponse<AppNotification>> {
    return this.api
      .get<unknown>(ENDPOINTS.list, { params: { ...query }, context: withSkipLoader() })
      .pipe(toPaged<AppNotification>());
  }

  markRead(n: AppNotification): void {
    if (n.isRead) return;
    this.api
      .post(ENDPOINTS.read(n.id), {}, { context: withSilentErrors(withSkipLoader()) })
      .subscribe({
        next: () => {
          this.unreadCount.update((c) => Math.max(0, c - 1));
          this.patchRecent(n.id, { isRead: true });
        },
        // Best-effort: a failed "mark read" only leaves the badge one too high.
        error: () => undefined,
      });
  }

  markAllRead(): Observable<unknown> {
    return this.api.post(ENDPOINTS.readAll, {}, { context: withSkipLoader() }).pipe(
      tap(() => {
        this.unreadCount.set(0);
        this.recent.update((list) => list.map((n) => ({ ...n, isRead: true })));
      }),
    );
  }

  acknowledge(n: AppNotification): Observable<unknown> {
    return this.api
      .post(ENDPOINTS.acknowledge(n.id), {}, { context: withSkipLoader() })
      .pipe(tap(() => this.patchRecent(n.id, { acknowledgedAtUtc: new Date().toISOString() })));
  }

  /** Marks as read and navigates to whatever the notification is about. */
  open(n: AppNotification): void {
    this.markRead(n);
    const link = notificationLink(n);
    if (link) void this.router.navigateByUrl(link);
  }

  private sync(): void {
    this.api
      .get<unknown>(ENDPOINTS.unreadCount, { context: withSilentErrors(withSkipLoader()) })
      .pipe(
        map(readCount),
        catchError(() => of(null)),
      )
      .subscribe((count) => count !== null && this.unreadCount.set(count));

    this.list({ pageIndex: 1, pageSize: RECENT_LIMIT })
      .pipe(catchError(() => of(null)))
      .subscribe((page) => page && this.recent.set(page.data));
  }

  private onLive(n: AppNotification): void {
    this.unreadCount.update((c) => c + 1);
    this.recent.update((list) => [n, ...list.filter((x) => x.id !== n.id)].slice(0, RECENT_LIMIT));

    const link = notificationLink(n);
    const options = {
      title: n.title,
      duration: n.severity === 'Critical' ? 0 : undefined,
      action: link ? { label: 'عرض', handler: () => this.open(n) } : undefined,
    };
    const message = n.body || n.title;
    if (n.severity === 'Critical') this.toast.error(message, options);
    else if (n.severity === 'Warning') this.toast.warning(message, options);
    else this.toast.info(message, options);
  }

  private patchRecent(id: string, patch: Partial<AppNotification>): void {
    this.recent.update((list) => list.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }
}

/** `{ count }`, `{ unreadCount }` or a bare number — tolerate all three. */
function readCount(data: unknown): number {
  if (typeof data === 'number') return data;
  const obj = (data ?? {}) as Record<string, unknown>;
  const value = obj['count'] ?? obj['unreadCount'] ?? obj['unread'];
  return typeof value === 'number' ? value : 0;
}

/** Deep link for a notification, from `relatedEntityType` + `relatedEntityId`. */
export function notificationLink(
  n: Pick<AppNotification, 'relatedEntityType' | 'relatedEntityId'>,
): string | null {
  const id = n.relatedEntityId;
  switch (n.relatedEntityType) {
    case 'MaintenanceAlert':
      return `${APP_ROUTES.alerts}?tab=oil`;
    case 'GpsIncident':
      return id ? APP_ROUTES.incident(id) : `${APP_ROUTES.alerts}?tab=gps`;
    case 'OilChangeSubmission':
      return id ? APP_ROUTES.oilChange(id) : APP_ROUTES.oilChanges;
    case 'MaintenanceRecord':
      return id ? APP_ROUTES.maintenanceRecord(id) : APP_ROUTES.maintenance;
    case 'RepairInvoice':
      return id ? APP_ROUTES.repairInvoice(id) : APP_ROUTES.repairInvoices;
    case 'DriverCharge':
      return id ? APP_ROUTES.driverCharge(id) : APP_ROUTES.drivers;
    case 'Document':
      return APP_ROUTES.documents;
    default:
      return null;
  }
}
