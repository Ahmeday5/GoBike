import { DeliveryStatus } from '@core/constants/enums';

export type IntegrationsTab = 'health' | 'sync' | 'deliveries';

/** Only the active tab lives in the URL at page level; each tab owns its own filter keys. */
export type IntegrationsPageQuery = { tab: IntegrationsTab };
export const INTEGRATIONS_PAGE_DEFAULTS: IntegrationsPageQuery = { tab: 'health' };

/** `GET /gps/sync-logs` filters. */
export type SyncLogsQuery = {
  integration: string;
  operation: string;
  success: '' | 'true' | 'false';
  pageIndex: number;
  pageSize: number;
};
export const SYNC_LOGS_QUERY_DEFAULTS: SyncLogsQuery = {
  integration: '',
  operation: '',
  success: '',
  pageIndex: 1,
  pageSize: 20,
};

/** `GET /notifications/deliveries` filters. */
export type DeliveriesQuery = {
  status: DeliveryStatus | '';
  userId: string;
  pageIndex: number;
  pageSize: number;
};
export const DELIVERIES_QUERY_DEFAULTS: DeliveriesQuery = {
  status: '',
  userId: '',
  pageIndex: 1,
  pageSize: 20,
};

/** One provider call. Undocumented shape → every field optional, read via fallbacks. */
export interface SyncLogDto {
  id?: string | number;
  integration?: string | null;
  provider?: string | null;
  operation?: string | null;
  success?: boolean | null;
  isSuccess?: boolean | null;
  startedAtUtc?: string | null;
  createdAtUtc?: string | null;
  finishedAtUtc?: string | null;
  durationMs?: number | null;
  elapsedMs?: number | null;
  message?: string | null;
  errorMessage?: string | null;
  itemsProcessed?: number | null;
  recordCount?: number | null;
}

/** One push/notification delivery attempt. Undocumented shape → optional fields. */
export interface NotificationDeliveryDto {
  id?: string | number;
  notificationId?: string | null;
  title?: string | null;
  notificationTitle?: string | null;
  userId?: string | null;
  userName?: string | null;
  recipientName?: string | null;
  channel?: string | null;
  status?: DeliveryStatus | null;
  attempts?: number | null;
  attemptCount?: number | null;
  error?: string | null;
  lastError?: string | null;
  errorMessage?: string | null;
  createdAtUtc?: string | null;
  sentAtUtc?: string | null;
  lastAttemptAtUtc?: string | null;
}

/** `GET /gps/health` — shape unknown; rendered generically. */
export type GpsHealthDto = Record<string, unknown>;

// ── Field readers (the DTOs above are undocumented, so read through aliases) ──

export const syncProvider = (l: SyncLogDto): string | null => l.integration ?? l.provider ?? null;
export const syncSuccess = (l: SyncLogDto): boolean | null => l.success ?? l.isSuccess ?? null;
export const syncTime = (l: SyncLogDto): string | null => l.startedAtUtc ?? l.createdAtUtc ?? null;
export const syncItems = (l: SyncLogDto): number | null =>
  l.itemsProcessed ?? l.recordCount ?? null;
export const syncError = (l: SyncLogDto): string | null => l.errorMessage ?? null;
/** Duration in ms: reported directly, or derived from start/finish. */
export function syncDurationMs(l: SyncLogDto): number | null {
  const direct = l.durationMs ?? l.elapsedMs;
  if (typeof direct === 'number') return direct;
  if (l.startedAtUtc && l.finishedAtUtc) {
    const ms = Date.parse(l.finishedAtUtc) - Date.parse(l.startedAtUtc);
    return Number.isFinite(ms) && ms >= 0 ? ms : null;
  }
  return null;
}
/** "850 مللي ث" / "2.4 ث" / "1 د 05 ث". */
export function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)} مللي ث`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} ث`;
  const m = Math.floor(s / 60);
  return `${m} د ${String(Math.round(s % 60)).padStart(2, '0')} ث`;
}

export const deliveryTitle = (d: NotificationDeliveryDto): string | null =>
  d.title ?? d.notificationTitle ?? null;
export const deliveryRecipient = (d: NotificationDeliveryDto): string | null =>
  d.recipientName ?? d.userName ?? null;
export const deliveryError = (d: NotificationDeliveryDto): string | null =>
  d.errorMessage ?? d.lastError ?? d.error ?? null;
export const deliveryTime = (d: NotificationDeliveryDto): string | null =>
  d.lastAttemptAtUtc ?? d.sentAtUtc ?? d.createdAtUtc ?? null;
export const deliveryAttempts = (d: NotificationDeliveryDto): number | null =>
  d.attempts ?? d.attemptCount ?? null;

/** Channel names → Arabic (unknown channels shown raw). */
export const DELIVERY_CHANNEL_LABELS: Record<string, string> = {
  Push: 'إشعار التطبيق',
  Fcm: 'إشعار التطبيق',
  FCM: 'إشعار التطبيق',
  InApp: 'داخل لوحة التحكم',
  SignalR: 'لحظي (لوحة التحكم)',
  Email: 'بريد إلكتروني',
  Sms: 'رسالة SMS',
  SMS: 'رسالة SMS',
};
