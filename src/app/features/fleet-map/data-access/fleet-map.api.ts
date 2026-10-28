import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { withSkipLoader } from '@core/http/http-context.tokens';
import { FleetMapItem } from '@core/realtime/realtime.models';
import { asList } from '@core/utils/api-list.util';
import { FleetMapQuery } from '../models/fleet-map.models';

@Injectable({ providedIn: 'root' })
export class FleetMapApi {
  private readonly api = inject(ApiService);

  /** `GET /fleet/map` — not paginated. */
  list(q: Pick<FleetMapQuery, 'officeId' | 'status'>): Observable<FleetMapItem[]> {
    return this.api
      .get<unknown>('fleet/map', { params: { ...q }, context: withSkipLoader() })
      .pipe(map((r) => asList<FleetMapItem>(r)));
  }
}
