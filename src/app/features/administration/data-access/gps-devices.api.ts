import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { PagedResponse } from '@core/models/api-response.model';
import { toPaged } from '@core/utils/api-list.util';
import { withSilentErrors, withSkipLoader } from '@core/http/http-context.tokens';
import {
  GpsDeviceDto,
  GpsDevicesQuery,
  LinkGpsDeviceRequest,
  RegisterGpsDeviceRequest,
  UpdateGpsDeviceRequest,
} from '../models/gps-device.models';

/** GPS trackers (`/gps/devices`). */
@Injectable({ providedIn: 'root' })
export class GpsDevicesApi {
  private readonly api = inject(ApiService);

  list(query: GpsDevicesQuery): Observable<PagedResponse<GpsDeviceDto>> {
    // `staleOnly=false` would read as a filter — only send it when switched on.
    const params = { ...query, staleOnly: query.staleOnly || '' };
    return this.api
      .get<unknown>('gps/devices', { params, context: withSkipLoader() })
      .pipe(toPaged<GpsDeviceDto>());
  }

  register(body: RegisterGpsDeviceRequest): Observable<GpsDeviceDto> {
    return this.api.post<GpsDeviceDto>('gps/devices', body, { context: withSilentErrors() });
  }

  update(id: string, body: UpdateGpsDeviceRequest): Observable<GpsDeviceDto> {
    return this.api.put<GpsDeviceDto>(`gps/devices/${id}`, body, { context: withSilentErrors() });
  }

  link(id: string, body: LinkGpsDeviceRequest): Observable<unknown> {
    return this.api.post(`gps/devices/${id}/link`, body, { context: withSilentErrors() });
  }

  unlink(id: string): Observable<unknown> {
    return this.api.post(`gps/devices/${id}/unlink`, {});
  }
}
