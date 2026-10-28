/**
 * Every in-app URL, in one place. Features, the sidebar and notification
 * deep links all build links from here, so a route can move without hunting
 * for string literals.
 */
export const APP_ROUTES = {
  map: '/map',

  motorcycles: '/motorcycles',
  motorcycle: (id: string, tab?: string) =>
    tab ? [`/motorcycles/${id}`, { tab }] : `/motorcycles/${id}`,
  motorcycleZone: (id: string) => `/motorcycles/${id}/zone`,

  drivers: '/drivers',
  driver: (id: string) => `/drivers/${id}`,

  rentals: '/rentals',
  inspections: '/inspections',

  maintenance: '/maintenance',
  maintenanceRecord: (id: string) => `/maintenance/${id}`,

  oilChanges: '/oil-changes',
  oilChange: (id: string) => `/oil-changes/${id}`,

  alerts: '/alerts',
  incident: (id: string) => `/alerts/incidents/${id}`,

  repairInvoices: '/repair-invoices',
  repairInvoice: (id: string) => `/repair-invoices/${id}`,

  /** Resolves a charge to its driver's account tab. */
  driverCharge: (id: string) => `/drivers/charges/${id}`,

  documents: '/documents',
  notifications: '/notifications',
  account: '/account',

  settings: {
    oilPolicy: '/settings/oil-policy',
    offices: '/settings/offices',
    users: '/settings/users',
    roles: '/settings/roles',
    gpsDevices: '/settings/gps-devices',
    integrations: '/settings/integrations',
  },
} as const;
