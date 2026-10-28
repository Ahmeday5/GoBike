import { GpsConnectivityStatus } from '@core/constants/enums';

/** URL-backed filters for `GET /gps/devices`. Empty string = "any". */
export type GpsDevicesQuery = {
  search: string;
  isLinked: '' | 'true' | 'false';
  isActive: '' | 'true' | 'false';
  connectivity: GpsConnectivityStatus | '';
  staleOnly: boolean;
  sortBy: 'imei' | 'name' | 'lastSeen' | '';
  sortDesc: boolean;
  pageIndex: number;
  pageSize: number;
};

export const GPS_DEVICES_QUERY_DEFAULTS: GpsDevicesQuery = {
  search: '',
  isLinked: '',
  isActive: '',
  connectivity: '',
  staleOnly: false,
  sortBy: '',
  sortDesc: false,
  pageIndex: 1,
  pageSize: 20,
};

/**
 * A tracker as listed by `GET /gps/devices`. Field names beyond imei/name/
 * isActive/notes aren't documented, so the common aliases are all optional
 * and read through the helpers below.
 */
export interface GpsDeviceDto {
  id: string;
  imei: string;
  deviceName?: string | null;
  name?: string | null;
  isActive?: boolean;
  notes?: string | null;
  motorcycleId?: string | null;
  plateNumber?: string | null;
  motorcyclePlateNumber?: string | null;
  connectivity?: GpsConnectivityStatus | null;
  connectivityStatus?: GpsConnectivityStatus | null;
  lastSeenAtUtc?: string | null;
  lastFixAtUtc?: string | null;
  lastLocationAtUtc?: string | null;
  isStale?: boolean | null;
  linkedAtUtc?: string | null;
  createdAtUtc?: string | null;
}

export const deviceName = (d: GpsDeviceDto): string | null => d.deviceName ?? d.name ?? null;
export const devicePlate = (d: GpsDeviceDto): string | null =>
  d.plateNumber ?? d.motorcyclePlateNumber ?? null;
export const deviceConnectivity = (d: GpsDeviceDto): string | null =>
  d.connectivity ?? d.connectivityStatus ?? null;
export const deviceLastSeen = (d: GpsDeviceDto): string | null =>
  d.lastSeenAtUtc ?? d.lastFixAtUtc ?? d.lastLocationAtUtc ?? null;

/** `POST /gps/devices` (Swagger: RegisterGpsDeviceRequest). */
export interface RegisterGpsDeviceRequest {
  imei: string;
  deviceName?: string | null;
  notes?: string | null;
}

/** `PUT /gps/devices/{id}` (Swagger: UpdateGpsDeviceRequest). */
export interface UpdateGpsDeviceRequest {
  isActive: boolean;
  notes?: string | null;
}

/** `POST /gps/devices/{id}/link` (Swagger: LinkGpsDeviceRequest). */
export interface LinkGpsDeviceRequest {
  motorcycleId: string;
  notes?: string | null;
}
