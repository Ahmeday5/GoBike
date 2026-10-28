import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { PagedResponse } from '@core/models/api-response.model';
import { MaintenanceRecordDto, MotorcycleDto, RentalDto } from '@core/models/domain.models';
import { asList, toPaged } from '@core/utils/api-list.util';
import { withSilentErrors, withSkipLoader } from '@core/http/http-context.tokens';
import {
  ChangeMotorcycleStatusRequest,
  MaintenancePolicyOption,
  MotorcyclesQuery,
  SaveMotorcycleRequest,
  SaveZoneRequest,
  SetMaintenanceBaselineRequest,
  TransferMotorcycleRequest,
} from '../models/motorcycle.models';
import {
  DailyMileage,
  GpsAlarmDto,
  MaintenanceCycleStatusDto,
  MotorcycleOverviewDto,
  MotorcycleZoneDto,
  RoutePoint,
  StatusHistoryDto,
  TransferDto,
} from '../models/motorcycle-overview.models';

const read = () => ({ context: withSkipLoader() });

/**
 * Motorcycle endpoints. Stateless: screens hold state (URL + resources).
 *
 * Context conventions used across features:
 *   - list/detail reads → `withSkipLoader()` (screens show skeletons instead
 *     of the global overlay)
 *   - form submits → `withSilentErrors()`; the form shows field errors itself
 *     via `applyServerErrors()`
 */
@Injectable({ providedIn: 'root' })
export class MotorcyclesApi {
  private readonly api = inject(ApiService);

  list(query: MotorcyclesQuery): Observable<PagedResponse<MotorcycleDto>> {
    return this.api
      .get<unknown>('motorcycles', { params: { ...query }, context: withSkipLoader() })
      .pipe(toPaged<MotorcycleDto>());
  }

  get(id: string): Observable<MotorcycleDto> {
    return this.api.get<MotorcycleDto>(`motorcycles/${id}`, { context: withSkipLoader() });
  }

  create(body: SaveMotorcycleRequest): Observable<MotorcycleDto> {
    return this.api.post<MotorcycleDto>('motorcycles', body, { context: withSilentErrors() });
  }

  update(id: string, body: SaveMotorcycleRequest): Observable<MotorcycleDto> {
    return this.api.put<MotorcycleDto>(`motorcycles/${id}`, body, { context: withSilentErrors() });
  }

  /** Soft delete. */
  delete(id: string): Observable<unknown> {
    return this.api.delete(`motorcycles/${id}`);
  }

  /** Oil-change policies for the motorcycle form's picker. */
  policies(): Observable<MaintenancePolicyOption[]> {
    return this.api
      .get<unknown>('maintenance/policies', { context: withSilentErrors(withSkipLoader()) })
      .pipe(map((r) => asList<MaintenancePolicyOption>(r)));
  }

  // ─────────────── Motorcycle page ───────────────

  overview(id: string): Observable<MotorcycleOverviewDto> {
    return this.api.get<MotorcycleOverviewDto>(`fleet/motorcycles/${id}/overview`, read());
  }

  changeStatus(id: string, body: ChangeMotorcycleStatusRequest): Observable<unknown> {
    return this.api.post(`motorcycles/${id}/status`, body, { context: withSilentErrors() });
  }

  transfer(id: string, body: TransferMotorcycleRequest): Observable<unknown> {
    return this.api.post(`motorcycles/${id}/transfer`, body, { context: withSilentErrors() });
  }

  setOilBaseline(id: string, body: SetMaintenanceBaselineRequest): Observable<unknown> {
    return this.api.post(`maintenance/motorcycles/${id}/baseline`, body, {
      context: withSilentErrors(),
    });
  }

  statusHistory(id: string): Observable<StatusHistoryDto[]> {
    return this.api
      .get<unknown>(`motorcycles/${id}/status-history`, read())
      .pipe(map((r) => asList<StatusHistoryDto>(r)));
  }

  transfers(id: string): Observable<TransferDto[]> {
    return this.api
      .get<unknown>(`motorcycles/${id}/transfers`, read())
      .pipe(map((r) => asList<TransferDto>(r)));
  }

  rentals(id: string, pageIndex: number, pageSize: number): Observable<PagedResponse<RentalDto>> {
    return this.api
      .get<unknown>(`motorcycles/${id}/rentals`, {
        params: { pageIndex, pageSize, sortDesc: true },
        context: withSkipLoader(),
      })
      .pipe(toPaged<RentalDto>());
  }

  // ─────────────── GPS history ───────────────

  route(id: string, fromUtc: string, toUtc: string): Observable<RoutePoint[]> {
    return this.api
      .get<unknown>(`gps/motorcycles/${id}/route`, {
        params: { fromUtc, toUtc },
        context: withSkipLoader(),
      })
      .pipe(map(toRoutePoints));
  }

  alarms(
    id: string,
    q: { fromUtc: string; toUtc: string; pageIndex: number; pageSize: number },
  ): Observable<PagedResponse<GpsAlarmDto>> {
    return this.api
      .get<unknown>(`gps/motorcycles/${id}/alarms`, { params: q, context: withSkipLoader() })
      .pipe(toPaged<GpsAlarmDto>());
  }

  // ─────────────── Maintenance & mileage ───────────────

  maintenanceStatus(id: string): Observable<MaintenanceCycleStatusDto | null> {
    return this.api.get<MaintenanceCycleStatusDto | null>(
      `maintenance/motorcycles/${id}/status`,
      read(),
    );
  }

  maintenanceRecords(
    motorcycleId: string,
    pageIndex: number,
    pageSize: number,
  ): Observable<PagedResponse<MaintenanceRecordDto>> {
    return this.api
      .get<unknown>('maintenance/records', {
        params: { motorcycleId, pageIndex, pageSize, sortDesc: true },
        context: withSkipLoader(),
      })
      .pipe(toPaged<MaintenanceRecordDto>());
  }

  dailyMileage(id: string, fromDate: string, toDate: string): Observable<DailyMileage[]> {
    return this.api
      .get<unknown>(`mileage/motorcycles/${id}/daily`, {
        params: { fromDate, toDate },
        context: withSkipLoader(),
      })
      .pipe(map(toDailyMileage));
  }

  // ─────────────── Zone ───────────────

  zone(id: string): Observable<MotorcycleZoneDto | null> {
    return this.api
      .get<MotorcycleZoneDto | null>(`motorcycles/${id}/zone`, read())
      .pipe(map((z) => (z && typeof z === 'object' && 'centerLatitude' in z ? z : null)));
  }

  saveZone(id: string, body: SaveZoneRequest): Observable<MotorcycleZoneDto> {
    return this.api.put<MotorcycleZoneDto>(`motorcycles/${id}/zone`, body, {
      context: withSilentErrors(),
    });
  }

  deleteZone(id: string): Observable<unknown> {
    return this.api.delete(`motorcycles/${id}/zone`);
  }
}

// ─────────────── Response normalizers ───────────────
// The GPS provider's field names aren't fixed in the contract, so read the
// common spellings instead of trusting one.

type Loose = Record<string, unknown>;

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v)
    ? v
    : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v)
      ? +v
      : null;

const pick = (o: Loose, ...keys: string[]): unknown => {
  for (const k of keys) if (o[k] != null) return o[k];
  return null;
};

/** Unwraps `{ points: [...] }` / `{ data: [...] }` / `[...]`. */
function listOf(r: unknown, ...keys: string[]): Loose[] {
  if (r && typeof r === 'object' && !Array.isArray(r)) {
    for (const k of keys) {
      const inner = (r as Loose)[k];
      if (Array.isArray(inner)) return inner as Loose[];
    }
  }
  return asList<Loose>(r);
}

function toRoutePoints(r: unknown): RoutePoint[] {
  const points: RoutePoint[] = [];
  for (const p of listOf(r, 'points', 'route', 'locations')) {
    const lat = num(pick(p, 'lat', 'latitude', 'Latitude'));
    const lng = num(pick(p, 'lng', 'lon', 'longitude', 'Longitude'));
    if (lat === null || lng === null || (lat === 0 && lng === 0)) continue;
    const at = pick(p, 'atUtc', 'recordedAtUtc', 'timeUtc', 'gpsTimeUtc', 'timestampUtc', 'time');
    points.push({
      lat,
      lng,
      speed: num(pick(p, 'speed', 'speedKmh')),
      course: num(pick(p, 'course', 'heading', 'direction')),
      atUtc: typeof at === 'string' ? at : null,
    });
  }
  // The provider usually sends chronological points, but don't rely on it.
  return points.sort((a, b) => (a.atUtc && b.atUtc ? a.atUtc.localeCompare(b.atUtc) : 0));
}

function toDailyMileage(r: unknown): DailyMileage[] {
  return listOf(r, 'days', 'items')
    .map((d) => ({
      date: String(pick(d, 'date', 'day', 'localDate') ?? '').slice(0, 10),
      km: num(pick(d, 'km', 'distanceKm', 'totalKm', 'mileageKm')) ?? 0,
    }))
    .filter((d) => d.date.length === 10)
    .sort((a, b) => a.date.localeCompare(b.date));
}
