import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { PagedResponse } from '@core/models/api-response.model';
import { toPaged } from '@core/utils/api-list.util';
import { withSilentErrors, withSkipLoader } from '@core/http/http-context.tokens';
import {
  GpsIncidentDto,
  IncidentsParams,
  MaintenanceAlertDto,
  OilAlertsParams,
  ResolveIncidentRequest,
} from '../models/alerts.models';

/** Oil alerts (5.9, alerts.*) and GPS incidents (incidents.*). Stateless. */
@Injectable({ providedIn: 'root' })
export class AlertsApi {
  private readonly api = inject(ApiService);

  oilAlerts(params: OilAlertsParams, silent = false): Observable<PagedResponse<MaintenanceAlertDto>> {
    return this.api
      .get<unknown>('maintenance/alerts', {
        params: { ...params },
        context: silent ? withSilentErrors(withSkipLoader()) : withSkipLoader(),
      })
      .pipe(toPaged<MaintenanceAlertDto>());
  }

  acknowledgeAlert(id: string): Observable<unknown> {
    return this.api.post(`maintenance/alerts/${id}/acknowledge`, {});
  }

  incidents(params: IncidentsParams, silent = false): Observable<PagedResponse<GpsIncidentDto>> {
    return this.api
      .get<unknown>('gps/incidents', {
        params: { ...params },
        context: silent ? withSilentErrors(withSkipLoader()) : withSkipLoader(),
      })
      .pipe(toPaged<GpsIncidentDto>());
  }

  incident(id: string): Observable<GpsIncidentDto> {
    return this.api.get<GpsIncidentDto>(`gps/incidents/${id}`, { context: withSkipLoader() });
  }

  acknowledgeIncident(id: string): Observable<unknown> {
    return this.api.post(`gps/incidents/${id}/acknowledge`, {});
  }

  resolveIncident(id: string, body: ResolveIncidentRequest): Observable<unknown> {
    return this.api.post(`gps/incidents/${id}/resolve`, body, { context: withSilentErrors() });
  }
}
