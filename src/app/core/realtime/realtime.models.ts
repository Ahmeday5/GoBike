import {
  GpsConnectivityStatus,
  MotorcycleHealth,
  MotorcycleStatus,
  NotificationSeverity,
  NotificationType,
  OilLevel,
} from '../constants/enums';

/**
 * One motorcycle on the live map — `GET /fleet/map` and the hub's
 * `locationsUpdated` event share this exact shape.
 */
export interface FleetMapItem {
  motorcycleId: string;
  plateNumber: string;
  internalCode?: string | null;
  brand?: string | null;
  model?: string | null;
  officeId: string;
  officeName?: string | null;
  status: MotorcycleStatus;
  health: MotorcycleHealth;
  latitude: number | null;
  longitude: number | null;
  speedKmh?: number | null;
  /** Heading in degrees (0 = north), for rotating the marker. */
  course?: number | null;
  lastGpsAtUtc?: string | null;
  hasTracker: boolean;
  /** No recent signal → faded marker. */
  isStale: boolean;
  connectivity?: GpsConnectivityStatus | null;
  driverId?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  kmSinceOilChange?: number | null;
  oilLevel?: OilLevel | null;
  openIncidents: number;
  isOutOfZone: boolean;
}

/** Hub `motorcycleHealthChanged`. */
export interface MotorcycleHealthChanged {
  motorcycleId: string;
  plateNumber: string;
  status: MotorcycleStatus;
  health: MotorcycleHealth;
}

/** What a notification links to (`relatedEntityType`). */
export type NotificationEntityType =
  | 'MaintenanceAlert'
  | 'GpsIncident'
  | 'OilChangeSubmission'
  | 'MaintenanceRecord'
  | 'RepairInvoice'
  | 'DriverCharge'
  | 'Document';

/** Hub `notification` event and `GET /notifications` items. */
export interface AppNotification {
  id: string;
  userId?: string | null;
  driverId?: string | null;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body?: string | null;
  relatedEntityType?: NotificationEntityType | string | null;
  relatedEntityId?: string | null;
  createdAtUtc: string;
  isRead?: boolean;
  readAtUtc?: string | null;
  requiresAcknowledgement?: boolean;
  acknowledgedAtUtc?: string | null;
}

export type HubStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
