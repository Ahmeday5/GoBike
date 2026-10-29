import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { PagedResponse } from '@core/models/api-response.model';
import { OfficeDto } from '@core/models/domain.models';
import { toPaged } from '@core/utils/api-list.util';
import { withSilentErrors, withSkipLoader } from '@core/http/http-context.tokens';
import { OfficeStatsDto, OfficesQuery, SaveOfficeRequest } from '../models/office.models';

/** Offices CRUD + stats (`/offices`). */
@Injectable({ providedIn: 'root' })
export class OfficesApi {
  private readonly api = inject(ApiService);

  list(query: OfficesQuery): Observable<PagedResponse<OfficeDto>> {
    return this.api
      .get<unknown>('offices', { params: { ...query }, context: withSkipLoader() })
      .pipe(toPaged<OfficeDto>());
  }

  create(body: SaveOfficeRequest): Observable<OfficeDto> {
    return this.api.post<OfficeDto>('offices', body, { context: withSilentErrors() });
  }

  update(id: string, body: SaveOfficeRequest): Observable<OfficeDto> {
    return this.api.put<OfficeDto>(`offices/${id}`, body, { context: withSilentErrors() });
  }

  delete(id: string): Observable<unknown> {
    return this.api.delete(`offices/${id}`);
  }

  stats(id: string): Observable<OfficeStatsDto> {
    // The details dialog renders its own error + retry.
    return this.api.get<OfficeStatsDto>(`offices/${id}/stats`, {
      context: withSilentErrors(withSkipLoader()),
    });
  }
}
