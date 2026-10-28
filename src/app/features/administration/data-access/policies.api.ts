import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { asList } from '@core/utils/api-list.util';
import { withSilentErrors, withSkipLoader } from '@core/http/http-context.tokens';
import { MaintenancePolicyDto, SaveMaintenancePolicyRequest } from '../models/policy.models';

/** Oil-change policies (`/maintenance/policies`). */
@Injectable({ providedIn: 'root' })
export class PoliciesApi {
  private readonly api = inject(ApiService);

  list(): Observable<MaintenancePolicyDto[]> {
    return this.api
      .get<unknown>('maintenance/policies', { context: withSkipLoader() })
      .pipe(map((r) => asList<MaintenancePolicyDto>(r)));
  }

  create(body: SaveMaintenancePolicyRequest): Observable<MaintenancePolicyDto> {
    return this.api.post<MaintenancePolicyDto>('maintenance/policies', body, {
      context: withSilentErrors(),
    });
  }

  update(id: string, body: SaveMaintenancePolicyRequest): Observable<MaintenancePolicyDto> {
    return this.api.put<MaintenancePolicyDto>(`maintenance/policies/${id}`, body, {
      context: withSilentErrors(),
    });
  }

  /** Quick action from a card (no form) — the interceptor toasts any 4xx. */
  save(id: string, body: SaveMaintenancePolicyRequest): Observable<MaintenancePolicyDto> {
    return this.api.put<MaintenancePolicyDto>(`maintenance/policies/${id}`, body);
  }
}
