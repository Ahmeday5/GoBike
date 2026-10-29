import { ALERT_RECIPIENT, AlertRecipient } from '@core/constants/enums';

/**
 * Oil-change policy as returned by `GET /maintenance/policies`. Swagger types
 * responses generically, so everything beyond the request fields is optional.
 * Recipients are a [Flags] enum on the wire — usually "Driver, Admin", but
 * tolerated as arrays or raw numbers too (see `parseRecipients`).
 */
export interface MaintenancePolicyDto {
  id: string;
  name: string;
  description?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  firstWarningKm?: number | null;
  secondWarningKm?: number | null;
  criticalKm?: number | null;
  maxKm?: number | null;
  overdueFinePerKm?: number | null;
  firstWarningRecipients?: unknown;
  secondWarningRecipients?: unknown;
  criticalRecipients?: unknown;
  overdueRecipients?: unknown;
  criticalReminderIntervalHours?: number | null;
  notifyOnlyHighestWhenSkipping?: boolean | null;
  motorcycleCount?: number | null;
  updatedAtUtc?: string | null;
  createdAtUtc?: string | null;
}

/** `POST /maintenance/policies` · `PUT /maintenance/policies/{id}` (Swagger: SaveMaintenancePolicyRequest). */
export interface SaveMaintenancePolicyRequest {
  name: string;
  description?: string | null;
  isDefault: boolean;
  isActive: boolean;
  firstWarningKm: number;
  secondWarningKm: number;
  criticalKm: number;
  maxKm: number;
  overdueFinePerKm: number;
  /** Flags as a comma-separated string, e.g. "Driver, Admin" ("None" when empty). */
  firstWarningRecipients: string;
  secondWarningRecipients: string;
  criticalRecipients: string;
  overdueRecipients: string;
  criticalReminderIntervalHours: number;
  notifyOnlyHighestWhenSkipping: boolean;
}

export const POLICY_DEFAULTS = {
  firstWarningKm: 400,
  secondWarningKm: 450,
  criticalKm: 500,
  maxKm: 600,
} as const;

/** Every real recipient (None is the empty set, never a choice). */
export const RECIPIENT_CHOICES = (Object.keys(ALERT_RECIPIENT) as AlertRecipient[]).filter(
  (r) => r !== 'None',
);

/** Flag bits in declaration order — only used when the API sends a raw number. */
const RECIPIENT_BITS: Record<number, AlertRecipient> = {
  1: 'Driver',
  2: 'Admin',
  4: 'TechnicalSupport',
  8: 'MaintenanceOfficer',
  16: 'Accountant',
};

/** Reads a recipients flags value ("Driver, Admin" | string[] | number) into a clean, ordered list. */
export function parseRecipients(raw: unknown): AlertRecipient[] {
  const found = new Set<string>();
  const visit = (v: unknown): void => {
    if (v == null) return;
    if (Array.isArray(v)) return v.forEach(visit);
    if (typeof v === 'number') {
      for (const [bit, name] of Object.entries(RECIPIENT_BITS)) {
        if (v & Number(bit)) found.add(name);
      }
      return;
    }
    if (typeof v === 'string') {
      for (const part of v.split(/[,|]/)) {
        const token = part.trim();
        if (!token) continue;
        if (/^\d+$/.test(token)) visit(Number(token));
        else {
          const match = RECIPIENT_CHOICES.find((r) => r.toLowerCase() === token.toLowerCase());
          if (match) found.add(match);
        }
      }
    }
  };
  visit(raw);
  return RECIPIENT_CHOICES.filter((r) => found.has(r));
}

/** A listed policy → full save body (for quick actions such as "make default"). */
export function policyToRequest(
  p: MaintenancePolicyDto,
  changes: Partial<SaveMaintenancePolicyRequest> = {},
): SaveMaintenancePolicyRequest {
  return {
    name: p.name,
    description: p.description ?? null,
    isDefault: !!p.isDefault,
    isActive: p.isActive ?? true,
    firstWarningKm: p.firstWarningKm ?? POLICY_DEFAULTS.firstWarningKm,
    secondWarningKm: p.secondWarningKm ?? POLICY_DEFAULTS.secondWarningKm,
    criticalKm: p.criticalKm ?? POLICY_DEFAULTS.criticalKm,
    maxKm: p.maxKm ?? POLICY_DEFAULTS.maxKm,
    overdueFinePerKm: p.overdueFinePerKm ?? 0,
    firstWarningRecipients: serializeRecipients(parseRecipients(p.firstWarningRecipients)),
    secondWarningRecipients: serializeRecipients(parseRecipients(p.secondWarningRecipients)),
    criticalRecipients: serializeRecipients(parseRecipients(p.criticalRecipients)),
    overdueRecipients: serializeRecipients(parseRecipients(p.overdueRecipients)),
    criticalReminderIntervalHours: p.criticalReminderIntervalHours ?? 24,
    notifyOnlyHighestWhenSkipping: p.notifyOnlyHighestWhenSkipping ?? true,
    ...changes,
  };
}

/** Recipients list → the comma-separated flags string the API expects. */
export function serializeRecipients(list: readonly string[]): string {
  const clean = RECIPIENT_CHOICES.filter((r) => list.includes(r));
  return clean.length ? clean.join(', ') : 'None';
}
