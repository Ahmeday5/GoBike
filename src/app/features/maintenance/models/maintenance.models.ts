import { FaultSeverity, MaintenanceStatus, MaintenanceType } from '@core/constants/enums';
import { MaintenanceRecordDto } from '@core/models/domain.models';

/**
 * Maintenance records & repairs (brief 5.7).
 *
 * Assumptions — Swagger only types responses as the generic envelope, so the
 * request bodies below follow the brief plus `MaintenanceRecordDto`:
 *   - `GET /maintenance/records` takes one `status` and one `type`, plus
 *     `officeId`, `motorcycleId`, `search`, `pageIndex`, `pageSize`, `sortDesc`.
 *     Unknown params are ignored by the backend, so `search` is sent as is.
 *   - `GET /maintenance/records/{id}` returns `MaintenanceRecordDto`.
 *   - Every mutation (`POST`/`PUT` record, `/start`, `/complete`, `/cancel`,
 *     `/report`, `/verify`) returns the updated record — but screens reload
 *     after a mutation instead of trusting the body (some return nothing).
 *   - `/start` takes `{ startedAtUtc? }`, `/complete` takes the optional
 *     wrap-up fields below, `/cancel` takes `{ reason }`.
 *   - `rowVersion` is echoed back on PUTs when the record carries one (409 →
 *     someone else edited, reload).
 *   - A record rejected by the supervisor goes back to the technician with
 *     `verificationRejectReason` set (status back to InProgress); approval
 *     clears it and completes the record.
 */

export type MaintenanceView = 'queue' | 'all';

/** Statuses the repair queue shows (one tab each). */
export const QUEUE_STATUSES = ['Scheduled', 'InProgress', 'AwaitingSupervisorApproval'] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

/** URL-backed state of the maintenance page (both views). Empty string = "any". */
export type MaintenancePageState = {
  view: MaintenanceView;
  /** Active queue tab. */
  queue: QueueStatus;
  /** "All records" filters. */
  status: MaintenanceStatus | '';
  type: MaintenanceType | '';
  search: string;
  /** Shared by both views. */
  officeId: string;
  motorcycleId: string;
  pageIndex: number;
  pageSize: number;
};

export const MAINTENANCE_PAGE_DEFAULTS: MaintenancePageState = {
  view: 'queue',
  queue: 'Scheduled',
  status: '',
  type: '',
  search: '',
  officeId: '',
  motorcycleId: '',
  pageIndex: 1,
  pageSize: 20,
};

/** Wire params for `GET /maintenance/records`. */
export interface MaintenanceRecordsQuery {
  status?: MaintenanceStatus | '';
  type?: MaintenanceType | '';
  officeId?: string;
  motorcycleId?: string;
  search?: string;
  pageIndex: number;
  pageSize: number;
  sortDesc?: boolean;
}

/** `POST /maintenance/records` · `PUT /maintenance/records/{id}`. */
export interface SaveMaintenanceRecordRequest {
  motorcycleId: string;
  type: MaintenanceType;
  scheduledAtUtc?: string | null;
  issueDescription?: string | null;
  workPerformed?: string | null;
  workshop?: string | null;
  technician?: string | null;
  laborCost?: number | null;
  otherCost?: number | null;
  notes?: string | null;
  resetsMaintenanceCycle?: boolean | null;
  rowVersion?: string | null;
}

/** `POST /maintenance/records/{id}/start`. */
export interface StartMaintenanceRequest {
  startedAtUtc?: string | null;
}

/** `POST /maintenance/records/{id}/complete` — every field optional. */
export interface CompleteMaintenanceRequest {
  completedAtUtc?: string | null;
  workPerformed?: string | null;
  laborCost?: number | null;
  otherCost?: number | null;
  notes?: string | null;
}

/** `POST /maintenance/records/{id}/cancel`. */
export interface CancelMaintenanceRequest {
  reason: string;
}

export interface ReportFault {
  description: string;
  severity: FaultSeverity;
  isFixed: boolean;
}

export interface ReportPart {
  partName: string;
  partNumber?: string | null;
  quantity: number;
  unitCost: number;
}

/** `PUT /maintenance/records/{id}/report` (technician, maintenance.manage). */
export interface TechnicianReportRequest {
  faults: ReportFault[];
  parts: ReportPart[];
  workPerformed?: string | null;
  technician?: string | null;
  laborCost?: number | null;
  otherCost?: number | null;
  /** false → save progress; true → send to the supervisor (AwaitingSupervisorApproval). */
  repairDone: boolean;
  rowVersion?: string | null;
}

/** `POST /maintenance/records/{id}/verify` (supervisor, maintenance.verify). */
export interface VerifyRepairRequest {
  approved: boolean;
  /** Required when rejecting. */
  reason?: string | null;
}

// ─────────────── helpers ───────────────

const isOpen = (r: MaintenanceRecordDto) => r.status !== 'Completed' && r.status !== 'Cancelled';

/** Technician may still edit the report: repair flow, open, not waiting for the supervisor. */
export function canWriteReport(r: MaintenanceRecordDto): boolean {
  return !!r.requiresSupervisorApproval && isOpen(r) && r.status !== 'AwaitingSupervisorApproval';
}

/** Supervisor rejected the last report and the technician hasn't resubmitted yet. */
export function isReturned(r: MaintenanceRecordDto): boolean {
  return !!r.verificationRejectReason && isOpen(r) && r.status !== 'AwaitingSupervisorApproval';
}

/** Parts cost: the API's figure, else the sum of the lines. */
export function partsTotal(r: MaintenanceRecordDto): number {
  if (typeof r.partsCost === 'number') return r.partsCost;
  return (r.parts ?? []).reduce(
    (sum, p) => sum + lineTotal(p.quantity, p.unitCost, p.totalCost),
    0,
  );
}

/** Grand total: the API's figure, else labor + other + parts. */
export function recordTotal(r: MaintenanceRecordDto): number {
  if (typeof r.totalCost === 'number') return r.totalCost;
  return (r.laborCost ?? 0) + (r.otherCost ?? 0) + partsTotal(r);
}

export function lineTotal(
  quantity: number | null | undefined,
  unitCost: number | null | undefined,
  total?: number | null,
): number {
  if (typeof total === 'number') return total;
  return round2((Number(quantity) || 0) * (Number(unitCost) || 0));
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Empty-string-tolerant number for optional money inputs. */
export function moneyOrNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
