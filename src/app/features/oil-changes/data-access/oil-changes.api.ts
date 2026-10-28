import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { AppConfigService } from '@core/config/app-config.service';
import { PagedResponse } from '@core/models/api-response.model';
import { OilChangeSubmissionDto } from '@core/models/domain.models';
import { toPaged } from '@core/utils/api-list.util';
import { withSilentErrors, withSkipLoader } from '@core/http/http-context.tokens';
import {
  ApproveOilChangeRequest,
  MotorcycleOilOverview,
  OilChangesQuery,
  RejectOilChangeRequest,
} from '../models/oil-change.models';

/** Oil-change video submissions (5.8). Stateless — screens hold the state. */
@Injectable({ providedIn: 'root' })
export class OilChangesApi {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  list(query: Partial<OilChangesQuery>): Observable<PagedResponse<OilChangeSubmissionDto>> {
    return this.api
      .get<unknown>('oil-changes', { params: { ...query }, context: withSkipLoader() })
      .pipe(toPaged<OilChangeSubmissionDto>());
  }

  get(id: string): Observable<OilChangeSubmissionDto> {
    return this.api.get<OilChangeSubmissionDto>(`oil-changes/${id}`, {
      context: withSkipLoader(),
    });
  }

  /**
   * The video needs the Bearer token, which a plain `<video src>` can't send,
   * so it's fetched as a blob. Progress events let the player show a bar —
   * and keep the timeout interceptor from cutting off a slow large download.
   * Errors are silent: the player renders its own state (404 = deleted).
   */
  video(id: string): Observable<HttpEvent<Blob>> {
    const url = `${this.config.apiUrl.replace(/\/+$/, '')}/oil-changes/${id}/video`;
    return this.http.get(url, {
      responseType: 'blob',
      observe: 'events',
      reportProgress: true,
      context: withSilentErrors(withSkipLoader()),
    });
  }

  approve(id: string, body: ApproveOilChangeRequest): Observable<OilChangeSubmissionDto> {
    return this.api.post<OilChangeSubmissionDto>(`oil-changes/${id}/approve`, body);
  }

  reject(id: string, body: RejectOilChangeRequest): Observable<OilChangeSubmissionDto> {
    return this.api.post<OilChangeSubmissionDto>(`oil-changes/${id}/reject`, body, {
      context: withSilentErrors(),
    });
  }

  /** Policy max km + fine price for the fine preview. Best-effort (silent). */
  oilOverview(motorcycleId: string): Observable<MotorcycleOilOverview> {
    return this.api.get<MotorcycleOilOverview>(`fleet/motorcycles/${motorcycleId}/overview`, {
      context: withSilentErrors(withSkipLoader()),
    });
  }
}
