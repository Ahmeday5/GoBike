import { StaffRole } from '../../constants/enums';

/**
 * Seeded dashboard roles. Labels and tones live in `STAFF_ROLE` (enums.ts).
 * `Driver` is reserved by the backend and is never a dashboard role.
 *
 * Prefer permission checks over role checks: admins can edit what each role
 * is allowed to do from the Roles screen.
 */
export const ROLES = {
  Admin: 'Admin',
  TechnicalSupport: 'TechnicalSupport',
  MaintenanceOfficer: 'MaintenanceOfficer',
  Accountant: 'Accountant',
} as const satisfies Record<StaffRole, StaffRole>;

export type KnownRole = (typeof ROLES)[keyof typeof ROLES];
