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
