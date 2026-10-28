import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { PagedResponse } from '@core/models/api-response.model';
import {
  DriverCredentials,
  DriverDto,
  OilChangeSubmissionDto,
  RentalDto,
} from '@core/models/domain.models';
import { toPaged } from '@core/utils/api-list.util';
import { withSilentErrors, withSkipLoader } from '@core/http/http-context.tokens';
import {
  ChangeDriverStatusRequest,
  CreateDriverAccountRequest,
  CreateDriverRequest,
  DriverWithCredentials,
  DriversQuery,
  SaveDriverRequest,
  SetDriverPasswordRequest,
} from '../models/driver.models';

/** Driver endpoints (brief 5.5). Stateless: screens hold state (URL + resources). */
@Injectable({ providedIn: 'root' })
export class DriversApi {
  private readonly api = inject(ApiService);

  list(query: DriversQuery): Observable<PagedResponse<DriverDto>> {
    return this.api
      .get<unknown>('drivers', { params: { ...query }, context: withSkipLoader() })
      .pipe(toPaged<DriverDto>());
  }

  /** Silent: ledger-only users get a 403 here and the page degrades instead of toasting. */
  get(id: string): Observable<DriverDto> {
    return this.api.get<DriverDto>(`drivers/${id}`, {
      context: withSilentErrors(withSkipLoader()),
    });
  }

  create(body: CreateDriverRequest): Observable<DriverWithCredentials> {
    return this.api.post<DriverWithCredentials>('drivers', body, { context: withSilentErrors() });
  }

  update(id: string, body: SaveDriverRequest): Observable<DriverDto> {
    return this.api.put<DriverDto>(`drivers/${id}`, body, { context: withSilentErrors() });
  }

  delete(id: string): Observable<unknown> {
    return this.api.delete(`drivers/${id}`);
  }

  changeStatus(id: string, body: ChangeDriverStatusRequest): Observable<DriverDto> {
    return this.api.post<DriverDto>(`drivers/${id}/status`, body, {
      context: withSilentErrors(),
    });
  }

  /** Signs the driver out of the app; the old password stops working. */
  resetPassword(id: string, body: SetDriverPasswordRequest): Observable<DriverCredentials> {
    return this.api.post<DriverCredentials>(`drivers/${id}/reset-password`, body, {
      context: withSilentErrors(),
    });
  }

  createAccount(id: string, body: CreateDriverAccountRequest): Observable<DriverWithCredentials> {
    return this.api.post<DriverWithCredentials>(`drivers/${id}/account`, body, {
      context: withSilentErrors(),
    });
  }

  rentals(id: string, pageIndex: number, pageSize: number): Observable<PagedResponse<RentalDto>> {
    return this.api
      .get<unknown>(`drivers/${id}/rentals`, {
        params: { pageIndex, pageSize, sortDesc: true },
        context: withSilentErrors(withSkipLoader()),
      })
      .pipe(toPaged<RentalDto>());
  }

  oilChanges(
    driverId: string,
    pageIndex: number,
    pageSize: number,
  ): Observable<PagedResponse<OilChangeSubmissionDto>> {
    return this.api
      .get<unknown>('oil-changes', {
        params: { driverId, pageIndex, pageSize },
        context: withSilentErrors(withSkipLoader()),
      })
      .pipe(toPaged<OilChangeSubmissionDto>());
  }
}
