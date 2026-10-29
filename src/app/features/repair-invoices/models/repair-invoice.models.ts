import { RepairInvoicePayer, RepairInvoiceStatus } from '@core/constants/enums';

/**
 * Repair invoices (brief 5.11). They arrive from the external accounting
 * program; the supervisor only decides who pays.
 *
 * Assumptions — Swagger types responses as the generic envelope, so the DTO
 * follows the brief; everything beyond it is optional and rendered only when
 * present:
 *   - `GET /repair-invoices` is paged and filters on `status`, `motorcycleId`,
 *     `officeId`.
 *   - `GET /repair-invoices/{id}` returns the same item shape.
 *   - `lines[]` has no fixed shape in the brief — `normalizeLines()` reads the
 *     common spellings (description/name, quantity/qty, unitPrice/unitCost/price,
 *     total/lineTotal/amount).
 *   - The decided state is read from `paidBy`, `chargedDriverId/Name` (falls
 *     back to the suggested driver when status is ChargedToDriver),
 *     `decidedAtUtc`, `decidedByName`, `decisionNotes`.
 *   - `POST /repair-invoices/{id}/decision` returns the updated invoice; the
 *     page reloads either way.
 */
export interface RepairInvoiceDto {
  id: string;
  externalInvoiceNumber?: string | null;
  amount: number;
  lines?: unknown[] | null;
  issuedAtUtc?: string | null;
  receivedAtUtc?: string | null;
  createdAtUtc?: string | null;
  vendorName?: string | null;
  notes?: string | null;
  motorcycleId?: string | null;
  plateNumber?: string | null;
  officeId?: string | null;
  officeName?: string | null;
  maintenanceRecordId?: string | null;
  /** Driver who returned the bike with the faults. */
  suggestedDriverId?: string | null;
  suggestedDriverName?: string | null;
  status: RepairInvoiceStatus;
  paidBy?: RepairInvoicePayer | null;
  chargedDriverId?: string | null;
  chargedDriverName?: string | null;
  driverChargeId?: string | null;
  decidedAtUtc?: string | null;
  decidedByName?: string | null;
  decisionNotes?: string | null;
}

export interface RepairInvoiceLine {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  total: number | null;
}

/** Status chip value meaning "every status" (the URL omits the default, so '' can't mean "all"). */
export const ALL_STATUSES = 'All';

export type RepairInvoicesState = {
  status: RepairInvoiceStatus | typeof ALL_STATUSES;
  officeId: string;
  motorcycleId: string;
  pageIndex: number;
  pageSize: number;
};

export const REPAIR_INVOICES_DEFAULTS: RepairInvoicesState = {
  status: 'PendingDecision',
  officeId: '',
  motorcycleId: '',
  pageIndex: 1,
  pageSize: 20,
};

export interface RepairInvoicesQuery {
  status?: RepairInvoiceStatus | '';
  officeId?: string;
  motorcycleId?: string;
  pageIndex: number;
  pageSize: number;
}

/** `POST /repair-invoices/{id}/decision` (repair_invoices.decide). */
export interface DecideRepairInvoiceRequest {
  paidBy: RepairInvoicePayer;
  /** Required when paidBy = Driver. */
  driverId?: string | null;
  notes?: string | null;
}

// ─────────────── line normalizer ───────────────

type Loose = Record<string, unknown>;

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v)
    ? v
    : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v)
      ? +v
      : null;

const pick = (o: Loose, ...keys: string[]): unknown => {
  for (const k of keys) if (o[k] != null && o[k] !== '') return o[k];
  return null;
};

/** Tolerant read of `lines[]` — strings, objects with any common field names. */
export function normalizeLines(lines: unknown): RepairInvoiceLine[] {
  if (!Array.isArray(lines)) return [];
  return lines.map((raw): RepairInvoiceLine => {
    if (typeof raw === 'string')
      return { description: raw, quantity: null, unitPrice: null, total: null };
    const o = (raw && typeof raw === 'object' ? raw : {}) as Loose;
    const quantity = num(pick(o, 'quantity', 'qty', 'count'));
    const unitPrice = num(pick(o, 'unitPrice', 'unitCost', 'price', 'rate'));
    const total =
      num(pick(o, 'total', 'totalPrice', 'lineTotal', 'totalCost', 'amount')) ??
      (quantity != null && unitPrice != null ? Math.round(quantity * unitPrice * 100) / 100 : null);
    const description = pick(o, 'description', 'name', 'itemName', 'partName', 'title');
    return {
      description: description != null ? String(description) : '—',
      quantity,
      unitPrice,
      total,
    };
  });
}
