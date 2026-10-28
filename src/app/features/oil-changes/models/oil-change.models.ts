import { OilChangeSubmissionStatus } from '@core/constants/enums';

/**
 * URL-backed queue filters (`GET /oil-changes`). Empty string = "any".
 * `motorcycleId` / `driverId` arrive from deep links (motorcycle / driver pages).
 */
export type OilChangesQuery = {
  status: OilChangeSubmissionStatus | '';
  officeId: string;
  motorcycleId: string;
  driverId: string;
  pageIndex: number;
  pageSize: number;
};

export const OIL_CHANGES_QUERY_DEFAULTS: OilChangesQuery = {
  status: 'Pending',
  officeId: '',
  motorcycleId: '',
  driverId: '',
  pageIndex: 1,
  pageSize: 12,
};

/** `POST /oil-changes/{id}/approve` (Swagger: ApproveOilChangeRequest). */
export interface ApproveOilChangeRequest {
  notes?: string | null;
}

/** `POST /oil-changes/{id}/reject` (Swagger: RejectOilChangeRequest). */
export interface RejectOilChangeRequest {
  reason?: string | null;
}

/**
 * The slice of `GET /fleet/motorcycles/{id}/overview` the review page needs
 * to estimate the fine (policy max km + price per km).
 */
export interface MotorcycleOilOverview {
  oilStatus?: {
    kmSinceOilChange?: number | null;
    maxKm?: number | null;
    finePerKm?: number | null;
  } | null;
}

/** Thresholds from the default policy — used only to color km when the bike's own policy is unknown. */
export const DEFAULT_OIL_THRESHOLDS = {
  firstWarningKm: 400,
  secondWarningKm: 450,
  criticalKm: 500,
  maxKm: 600,
} as const;

/** Expected fine shown before approving. `amount === null` → the system will compute it. */
export interface FineEstimate {
  overKm: number;
  rate: number | null;
  amount: number | null;
  maxKm: number;
  /** maxKm came from the default policy, not the bike's own. */
  assumedMax: boolean;
}

/** km at submit → oil level class (`.oil-<Level>` in styles/_map.scss). */
export function oilLevelClass(km: number | null | undefined, maxKm: number = DEFAULT_OIL_THRESHOLDS.maxKm): string {
  if (km == null) return 'oil-None';
  if (km > maxKm) return 'oil-Overdue';
  if (km >= DEFAULT_OIL_THRESHOLDS.criticalKm) return 'oil-Critical';
  if (km >= DEFAULT_OIL_THRESHOLDS.firstWarningKm) return 'oil-FirstWarning';
  return 'oil-None';
}
