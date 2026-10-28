import {
  GpsConnectivityStatus,
  GpsIncidentType,
  IncidentStatus,
  InspectionResult,
  MaintenanceAlertLevel,
  MaintenanceAlertStatus,
  MaintenanceStatus,
  MotorcycleHealth,
  MotorcycleStatus,
  OilChangeSubmissionStatus,
  OilLevel,
} from '@core/constants/enums';
import { MotorcycleDto } from '@core/models/domain.models';

/*
 * Response shapes for the motorcycle page. Swagger types responses only as a
 * generic envelope, so these follow the API brief (5.2 / 5.4) and everything
 * the brief doesn't spell out is optional — templates render `?? '—'`.
 */

/** `GET /fleet/motorcycles/{id}/overview` — everything the page header + overview tab need. */
export interface MotorcycleOverviewDto {
  motorcycle: MotorcycleDto;
  health?: MotorcycleHealth | null;
  /** null when the bike has no tracker. */
  location?: OverviewLocation | null;
  currentRental?: OverviewRental | null;
  oilStatus?: OverviewOilStatus | null;
  openAlerts?: OverviewAlert[] | null;
  openIncidents?: OverviewIncident[] | null;
  zone?: MotorcycleZoneDto | null;
  lastInspection?: OverviewInspection | null;
  openRepair?: OverviewRepair | null;
  lastOilChangeAtUtc?: string | null;
}

export interface OverviewLocation {
  latitude?: number | null;
  longitude?: number | null;
  speedKmh?: number | null;
  course?: number | null;
  /** Battery — the backend name isn't pinned down; both spellings are read. */
  batteryPercent?: number | null;
  batteryLevel?: number | null;
  externalVoltage?: number | null;
  externalVolts?: number | null;
  connectivity?: GpsConnectivityStatus | null;
  odometerKm?: number | null;
  isStale?: boolean | null;
  lastGpsAtUtc?: string | null;
  recordedAtUtc?: string | null;
}

export interface OverviewRental {
  rentalId?: string | null;
  id?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  startAtUtc?: string | null;
  /** The driver's unpaid debt (EGP). */
  driverOutstanding?: number | null;
}

export interface OverviewOilStatus {
  kmSinceOilChange?: number | null;
  firstWarningKm?: number | null;
  secondWarningKm?: number | null;
  criticalKm?: number | null;
  maxKm?: number | null;
  currentLevel?: OilLevel | null;
  remainingToMaxKm?: number | null;
  overdueKm?: number | null;
  finePerKm?: number | null;
  estimatedFine?: number | null;
  latestSubmission?: {
    id?: string | null;
    status?: OilChangeSubmissionStatus | null;
    submittedAtUtc?: string | null;
    kmAtSubmit?: number | null;
  } | null;
}

export interface OverviewAlert {
  id: string;
  level?: MaintenanceAlertLevel | null;
  status?: MaintenanceAlertStatus | null;
  kmAtAlert?: number | null;
  message?: string | null;
  createdAtUtc?: string | null;
}

export interface OverviewIncident {
  id: string;
  type?: GpsIncidentType | null;
  status?: IncidentStatus | null;
  message?: string | null;
  description?: string | null;
  startedAtUtc?: string | null;
  createdAtUtc?: string | null;
}

export interface OverviewInspection {
  id?: string | null;
  result?: InspectionResult | null;
  inspectedAtUtc?: string | null;
  driverName?: string | null;
  faultCount?: number | null;
  faultSummary?: string | null;
}

export interface OverviewRepair {
  maintenanceRecordId?: string | null;
  status?: MaintenanceStatus | null;
  faultCount?: number | null;
  partCount?: number | null;
}

/** `GET /motorcycles/{id}/zone` (null when none) and `overview.zone`. */
export interface MotorcycleZoneDto {
  id?: string | null;
  name?: string | null;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
  isActive?: boolean | null;
  /** The bike's last position is outside the circle. */
  isOutside?: boolean | null;
  distanceFromCenterMeters?: number | null;
}

// ─────────────────────────── GPS history ───────────────────────────

/** A route point, normalized from whatever field names the provider uses. */
export interface RoutePoint {
  lat: number;
  lng: number;
  speed: number | null;
  course: number | null;
  atUtc: string | null;
}

/** `GET /gps/motorcycles/{id}/alarms` items. */
export interface GpsAlarmDto {
  id?: string | null;
  type?: string | null;
  alarmType?: string | null;
  message?: string | null;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  speedKmh?: number | null;
  atUtc?: string | null;
  alarmAtUtc?: string | null;
  occurredAtUtc?: string | null;
}

// ─────────────────────────── Maintenance ───────────────────────────

/** `GET /maintenance/motorcycles/{id}/status` — the oil-change cycle of one bike. */
export interface MaintenanceCycleStatusDto {
  policyName?: string | null;
  kmSinceOilChange?: number | null;
  kmSinceLastMaintenance?: number | null;
  firstWarningKm?: number | null;
  secondWarningKm?: number | null;
  criticalKm?: number | null;
  maxKm?: number | null;
  currentLevel?: OilLevel | null;
  remainingToMaxKm?: number | null;
  overdueKm?: number | null;
  lastMaintenanceAtUtc?: string | null;
  lastOilChangeAtUtc?: string | null;
  lastMaintenanceOdometerKm?: number | null;
  currentOdometerKm?: number | null;
  baselineSetAtUtc?: string | null;
}

// ─────────────────────────── History ───────────────────────────

/** `GET /motorcycles/{id}/status-history` items. */
export interface StatusHistoryDto {
  id?: string | null;
  fromStatus?: MotorcycleStatus | null;
  toStatus?: MotorcycleStatus | null;
  status?: MotorcycleStatus | null;
  reason?: string | null;
  changedAtUtc?: string | null;
  createdAtUtc?: string | null;
  changedByName?: string | null;
  changedByUserName?: string | null;
}

/** `GET /motorcycles/{id}/transfers` items. */
export interface TransferDto {
  id?: string | null;
  fromOfficeName?: string | null;
  toOfficeName?: string | null;
  fromSupervisorName?: string | null;
  toSupervisorName?: string | null;
  reason?: string | null;
  transferredAtUtc?: string | null;
  createdAtUtc?: string | null;
  transferredByName?: string | null;
}

// ─────────────────────────── Mileage ───────────────────────────

/** One day of `GET /mileage/motorcycles/{id}/daily`, normalized. */
export interface DailyMileage {
  date: string;
  km: number;
}

/** Tabs of the motorcycle page (`?tab=`). */
export type MotorcycleTab =
  | 'overview'
  | 'route'
  | 'alarms'
  | 'maintenance'
  | 'rentals'
  | 'status'
  | 'transfers'
  | 'documents'
  | 'mileage';
