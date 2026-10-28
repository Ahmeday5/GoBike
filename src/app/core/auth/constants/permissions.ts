/**
 * Single source of truth for permission strings — must mirror the backend
 * (`GET /roles/permissions`). Never hard-code a permission string anywhere
 * else (routes, nav, `*appHasPermission`); reference these constants.
 *
 * The backend enforces every permission; the UI uses them only to hide what
 * the user can't do.
 *
 *   canActivate: [permissionGuard(PERMISSIONS.Drivers.Read)]
 *   <button *appHasPermission="PERMISSIONS.Drivers.Manage">…</button>
 */
export const PERMISSIONS = {
  Gps: {
    Read: 'gps.read',
    History: 'gps.history',
    Manage: 'gps.manage',
  },
  Motorcycles: {
    Read: 'motorcycles.read',
    Manage: 'motorcycles.manage',
    ChangeStatus: 'motorcycles.change_status',
    Transfer: 'motorcycles.transfer',
    Zone: 'motorcycles.zone',
  },
  Drivers: {
    Read: 'drivers.read',
    Manage: 'drivers.manage',
  },
  Assignments: {
    Read: 'assignments.read',
    Manage: 'assignments.manage',
  },
  Inspections: {
    Read: 'inspections.read',
    Manage: 'inspections.manage',
  },
  Maintenance: {
    Read: 'maintenance.read',
    Manage: 'maintenance.manage',
    Policies: 'maintenance.policies',
    OilReview: 'maintenance.oil_review',
    Verify: 'maintenance.verify',
  },
  Alerts: {
    Read: 'alerts.read',
    Manage: 'alerts.manage',
  },
  Incidents: {
    Read: 'incidents.read',
    Manage: 'incidents.manage',
  },
  DriverLedger: {
    Read: 'driver_ledger.read',
  },
  DriverPayments: {
    Manage: 'driver_payments.manage',
  },
  RepairInvoices: {
    Decide: 'repair_invoices.decide',
  },
  Documents: {
    Read: 'documents.read',
    Manage: 'documents.manage',
  },
  Users: {
    Read: 'users.read',
    Manage: 'users.manage',
  },
  Roles: {
    Manage: 'roles.manage',
  },
  Offices: {
    Read: 'offices.read',
    Manage: 'offices.manage',
  },
  Integrations: {
    Read: 'integrations.read',
  },
} as const;

type Leaves<T> = T extends string ? T : { [K in keyof T]: Leaves<T[K]> }[keyof T];

/** Union of every known permission string. */
export type Permission = Leaves<typeof PERMISSIONS>;
