import { MotorcycleStatus } from '@core/constants/enums';

/**
 * URL-backed list filters (`GET /motorcycles`). Empty string = "any".
 * A `type` (not an interface) so it satisfies `injectUrlState`'s record
 * constraint without an index signature — typos stay compile errors.
 */
export type MotorcyclesQuery = {
  search: string;
  status: MotorcycleStatus | '';
  officeId: string;
  /** '' | 'true' | 'false' — kept as text so "any" survives the URL round-trip. */
  hasGpsDevice: '' | 'true' | 'false';
  sortBy: 'plate' | 'brand' | 'status' | 'year' | 'createdAt' | '';
  sortDesc: boolean;
  pageIndex: number;
  pageSize: number;
};

export const MOTORCYCLES_QUERY_DEFAULTS: MotorcyclesQuery = {
  search: '',
  status: '',
  officeId: '',
  hasGpsDevice: '',
  sortBy: '',
  sortDesc: false,
  pageIndex: 1,
  pageSize: 20,
};

/** `POST /motorcycles` / `PUT /motorcycles/{id}` (Swagger: SaveMotorcycleRequest). */
export interface SaveMotorcycleRequest {
  plateNumber: string;
  internalCode?: string | null;
  brand: string;
  model: string;
  manufacturingYear?: number | null;
  color?: string | null;
  chassisNumber?: string | null;
  engineNumber?: string | null;
  purchaseDate?: string | null;
  purchasePrice: number;
  preparationCost: number;
  equipmentCost: number;
  officeId: string;
  supervisorUserId?: string | null;
  maintenancePolicyId?: string | null;
  notes?: string | null;
  /** Required on update — a 409 means someone else saved first. */
  rowVersion?: string | null;
}

/** Oil-change policy, as listed for the "maintenance policy" picker. */
export interface MaintenancePolicyOption {
  id: string;
  name: string;
  isDefault?: boolean;
  isActive?: boolean;
}

/** `POST /motorcycles/{id}/status` (Swagger: ChangeMotorcycleStatusRequest). */
export interface ChangeMotorcycleStatusRequest {
  status: MotorcycleStatus;
  reason?: string | null;
}

/** `POST /motorcycles/{id}/transfer` (Swagger: TransferMotorcycleRequest). */
export interface TransferMotorcycleRequest {
  toOfficeId: string;
  toSupervisorUserId?: string | null;
  reason?: string | null;
}

/**
 * `POST /maintenance/motorcycles/{id}/baseline` (Swagger: SetMaintenanceBaselineRequest).
 * Send exactly one of the two distances.
 */
export interface SetMaintenanceBaselineRequest {
  distanceSinceLastMaintenanceKm?: number | null;
  odometerAtLastMaintenanceKm?: number | null;
  notes?: string | null;
}

/** `PUT /motorcycles/{id}/zone` (Swagger: SaveZoneRequest). */
export interface SaveZoneRequest {
  name?: string | null;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
  isActive: boolean;
}
