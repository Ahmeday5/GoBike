import { MotorcycleHealth, MotorcycleStatus } from '@core/constants/enums';
import { FleetMapItem } from '@core/realtime/realtime.models';

/**
 * URL-backed map filters. `officeId`/`status` go to `GET /fleet/map`; health
 * and the offline view are applied on the client too, because live
 * `locationsUpdated` batches carry the whole office and the counters must
 * stay meaningful whatever is selected.
 */
export type FleetMapQuery = {
  officeId: string;
  status: MotorcycleStatus | '';
  health: MotorcycleHealth | '';
  /** 'offline' = stale signal or offline tracker. */
  view: '' | 'offline';
};

export const FLEET_MAP_QUERY_DEFAULTS: FleetMapQuery = {
  officeId: '',
  status: '',
  health: '',
  view: '',
};

/** Bikes that can't be placed: no tracker, or no fix yet. */
export function hasPosition(m: FleetMapItem): boolean {
  return (
    m.hasTracker !== false &&
    typeof m.latitude === 'number' &&
    typeof m.longitude === 'number' &&
    !(m.latitude === 0 && m.longitude === 0)
  );
}

export function isOffline(m: FleetMapItem): boolean {
  return m.isStale || m.connectivity === 'Offline';
}
