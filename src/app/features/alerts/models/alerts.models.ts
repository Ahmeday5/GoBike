import {
  GpsIncidentType,
  IncidentStatus,
  MaintenanceAlertLevel,
  MaintenanceAlertStatus,
} from '@core/constants/enums';
import { AppNotification } from '@core/realtime/realtime.models';

export type AlertsTab = 'oil' | 'gps' | 'zone';

/** Page-level URL state: only the active tab (each tab owns its own filters). */
export type AlertsCenterQuery = {
  tab: AlertsTab | '';
};

/** `GET /maintenance/alerts` filters (URL-backed). */
export type OilAlertsQuery = {
  openOnly: boolean;
  level: MaintenanceAlertLevel | '';
  status: MaintenanceAlertStatus | '';
  officeId: string;
  pageIndex: number;
  pageSize: number;
};

export const OIL_ALERTS_QUERY_DEFAULTS: OilAlertsQuery = {
  openOnly: true,
  level: '',
  status: '',
  officeId: '',
  pageIndex: 1,
  pageSize: 20,
};

/** `GET /gps/incidents` filters (URL-backed). `from`/`to` are Cairo datetime-local values. */
export type IncidentsQuery = {
  unresolvedOnly: boolean;
  type: GpsIncidentType | '';
  status: IncidentStatus | '';
  officeId: string;
  from: string;
  to: string;
  pageIndex: number;
  pageSize: number;
};

export const INCIDENTS_QUERY_DEFAULTS: IncidentsQuery = {
  unresolvedOnly: true,
  type: '',
  status: '',
  officeId: '',
  from: '',
  to: '',
  pageIndex: 1,
  pageSize: 20,
};

/** Wire params for `GET /gps/incidents` (Swagger names). */
export interface IncidentsParams {
  unresolvedOnly?: boolean;
  type?: GpsIncidentType | '';
  status?: IncidentStatus | '';
  motorcycleId?: string;
  officeId?: string;
  fromUtc?: string | null;
  toUtc?: string | null;
  pageIndex: number;
  pageSize: number;
}

/** Wire params for `GET /maintenance/alerts`. */
export interface OilAlertsParams {
  openOnly?: boolean;
  level?: MaintenanceAlertLevel | '';
  status?: MaintenanceAlertStatus | '';
  motorcycleId?: string;
  officeId?: string;
  pageIndex: number;
  pageSize: number;
}

/** `POST /gps/incidents/{id}/resolve` (Swagger: ResolveIncidentRequest). */
export interface ResolveIncidentRequest {
  resolutionNotes?: string | null;
}

/** Oil-change alert (`GET /maintenance/alerts` item). Shape follows the brief; render defensively. */
export interface MaintenanceAlertDto {
  id: string;
  motorcycleId: string;
  plateNumber?: string | null;
  officeId?: string | null;
  officeName?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  level: MaintenanceAlertLevel;
  status: MaintenanceAlertStatus;
  /** km since the last accepted oil change when the alert was raised. */
  kmSinceOilChange?: number | null;
  kmAtAlert?: number | null;
  thresholdKm?: number | null;
  message?: string | null;
  raisedAtUtc?: string | null;
  createdAtUtc?: string | null;
  acknowledgedAtUtc?: string | null;
  acknowledgedByName?: string | null;
  resolvedAtUtc?: string | null;
}

/** GPS / power / zone incident (`GET /gps/incidents` item and detail). */
export interface GpsIncidentDto {
  id: string;
  motorcycleId?: string | null;
  plateNumber?: string | null;
  officeId?: string | null;
  officeName?: string | null;
  deviceId?: string | null;
  imei?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  type: GpsIncidentType;
  status: IncidentStatus;
  title?: string | null;
  message?: string | null;
  description?: string | null;
  startedAtUtc?: string | null;
  detectedAtUtc?: string | null;
  createdAtUtc?: string | null;
  lastSeenAtUtc?: string | null;
  acknowledgedAtUtc?: string | null;
  acknowledgedByName?: string | null;
  resolvedAtUtc?: string | null;
  resolvedByName?: string | null;
  resolutionNotes?: string | null;
  autoResolved?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
  lastLatitude?: number | null;
  lastLongitude?: number | null;
  lastKnownLatitude?: number | null;
  lastKnownLongitude?: number | null;
}

/** Last known position, whichever field name the backend uses. */
export function incidentPosition(i: GpsIncidentDto): [number, number] | null {
  const lat = i.lastKnownLatitude ?? i.lastLatitude ?? i.latitude;
  const lng = i.lastKnownLongitude ?? i.lastLongitude ?? i.longitude;
  return lat != null && lng != null ? [lat, lng] : null;
}

export function incidentStartedAt(i: GpsIncidentDto): string | null {
  return i.startedAtUtc ?? i.detectedAtUtc ?? i.createdAtUtc ?? null;
}

/** Incident types the backend closes by itself once the condition clears. */
export const AUTO_RESOLVING_TYPES: readonly GpsIncidentType[] = [
  'DeviceOffline',
  'NoRecentLocation',
  'SuspectedPowerDisconnect',
  'OutOfZone',
];

/** Threshold (km) behind each oil alert level, for the "km" hint next to the chip. */
export const OIL_LEVEL_KM: Record<MaintenanceAlertLevel, string> = {
  FirstWarning: '400',
  SecondWarning: '450',
  Critical: '500',
  Overdue: '600+',
};

const OIL_NOTIFICATION_TYPES = ['MaintenanceWarning', 'MaintenanceCritical', 'OilChangeOverdue'];
const INCIDENT_NOTIFICATION_TYPES = [
  'GpsOffline',
  'PowerDisconnected',
  'SuspectedPowerDisconnect',
  'LowBattery',
  'ProviderOutage',
  'IncidentUpdate',
  'ZoneExit',
];

/** Does a live hub notification concern oil alerts? (→ refresh that table/counter) */
export function isOilNotification(n: Pick<AppNotification, 'type' | 'relatedEntityType'>): boolean {
  return n.relatedEntityType === 'MaintenanceAlert' || OIL_NOTIFICATION_TYPES.includes(n.type);
}

export function isIncidentNotification(
  n: Pick<AppNotification, 'type' | 'relatedEntityType'>,
): boolean {
  return n.relatedEntityType === 'GpsIncident' || INCIDENT_NOTIFICATION_TYPES.includes(n.type);
}

export const SUSPECTED_POWER_HINT =
  'مشتبه: انقطع إرسال جهاز التتبع بينما كان المحرك يعمل — قد يكون فصلًا متعمدًا للكهرباء أو ضعفًا في الشبكة. يُغلق تلقائيًا عند عودة الإشارة.';
