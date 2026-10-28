import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { PagedResponse } from '@core/models/api-response.model';
import { toPaged } from '@core/utils/api-list.util';
import { withSkipLoader } from '@core/http/http-context.tokens';
import {
  DeliveriesQuery,
  GpsHealthDto,
  NotificationDeliveryDto,
  SyncLogDto,
  SyncLogsQuery,
} from '../models/integration.models';

/** Read-only integration monitoring: GPS provider health, sync logs, notification deliveries. */
@Injectable({ providedIn: 'root' })
export class IntegrationsApi {
  private readonly api = inject(ApiService);

  gpsHealth(): Observable<GpsHealthDto> {
    return this.api
      .get<unknown>('gps/health', { context: withSkipLoader() })
      .pipe(
        map((r) => (r && typeof r === 'object' && !Array.isArray(r) ? (r as GpsHealthDto) : {})),
      );
  }

  syncLogs(query: SyncLogsQuery): Observable<PagedResponse<SyncLogDto>> {
    return this.api
      .get<unknown>('gps/sync-logs', { params: { ...query }, context: withSkipLoader() })
      .pipe(toPaged<SyncLogDto>());
  }

  deliveries(query: DeliveriesQuery): Observable<PagedResponse<NotificationDeliveryDto>> {
    return this.api
      .get<unknown>('notifications/deliveries', {
        params: { ...query },
        context: withSkipLoader(),
      })
      .pipe(toPaged<NotificationDeliveryDto>());
  }
}
