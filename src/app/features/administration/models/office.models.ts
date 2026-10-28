/** URL-backed filters for `GET /offices`. Empty string = "any". */
export type OfficesQuery = {
  search: string;
  /** '' | 'true' | 'false' — text so "any" survives the URL round-trip. */
  isActive: '' | 'true' | 'false';
  city: string;
  sortBy: 'name' | 'code' | 'city' | 'createdAt' | '';
  sortDesc: boolean;
  pageIndex: number;
  pageSize: number;
};

export const OFFICES_QUERY_DEFAULTS: OfficesQuery = {
  search: '',
  isActive: '',
  city: '',
  sortBy: '',
  sortDesc: false,
  pageIndex: 1,
  pageSize: 20,
};

/** `POST /offices` · `PUT /offices/{id}` (Swagger: SaveOfficeRequest). */
export interface SaveOfficeRequest {
  name: string;
  code?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  managerUserId?: string | null;
  isActive: boolean;
  notes?: string | null;
}

/**
 * `GET /offices/{id}/stats`. Only `staffCount` is documented — the rest is
 * rendered generically, so unknown counters still show up.
 */
export interface OfficeStatsDto {
  staffCount?: number | null;
  [key: string]: unknown;
}

/** Arabic labels for the stats keys we can anticipate; unknown keys are shown raw. */
export const OFFICE_STATS_LABELS: Record<string, string> = {
  staffCount: 'الموظفون',
  activeStaffCount: 'الموظفون النشطون',
  motorcycleCount: 'الموتوسيكلات',
  motorcyclesCount: 'الموتوسيكلات',
  totalMotorcycles: 'الموتوسيكلات',
  availableMotorcycles: 'موتوسيكلات متاحة',
  rentedMotorcycles: 'موتوسيكلات مؤجرة',
  underMaintenanceMotorcycles: 'تحت الصيانة',
  redMotorcycles: 'بها مشكلة',
  greenMotorcycles: 'سليمة',
  driverCount: 'السائقون',
  driversCount: 'السائقون',
  activeDrivers: 'السائقون النشطون',
  activeRentals: 'إيجارات سارية',
  activeRentalCount: 'إيجارات سارية',
  openAlerts: 'تنبيهات زيت مفتوحة',
  openIncidents: 'حوادث تتبع مفتوحة',
  openRepairs: 'إصلاحات مفتوحة',
  gpsDeviceCount: 'أجهزة التتبع',
  totalOutstanding: 'مديونيات السائقين',
  officeName: 'المكتب',
  officeId: 'معرّف المكتب',
};
