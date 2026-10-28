import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { PagedResponse } from '@core/models/api-response.model';
import { InspectionDto, RentalDto } from '@core/models/domain.models';
import { toPaged } from '@core/utils/api-list.util';
import { cairoInputToUtc } from '@core/utils/cairo-time.util';
import { withSilentErrors, withSkipLoader } from '@core/http/http-context.tokens';
import {
  CancelRentalRequest,
  InspectionsQuery,
  RentalDetailDto,
  RentalsQuery,
  ReturnMotorcycleRequest,
  StartRentalRequest,
  UpdateRentalTermsRequest,
} from '../models/rental.models';

/** Rentals (5.6) and return inspections. Stateless. */
@Injectable({ providedIn: 'root' })
export class RentalsApi {
  private readonly api = inject(ApiService);

  list(q: RentalsQuery): Observable<PagedResponse<RentalDto>> {
    // URL keeps Cairo calendar days; the API wants a UTC window covering them.
    const params = {
      search: q.search,
      status: q.status,
      officeId: q.officeId,
      motorcycleId: q.motorcycleId,
      driverId: q.driverId,
      fromUtc: q.from ? (cairoInputToUtc(`${q.from}T00:00`) ?? '') : '',
      toUtc: q.to ? (cairoInputToUtc(`${q.to}T23:59`) ?? '') : '',
      sortBy: q.sortBy,
      sortDesc: q.sortBy ? q.sortDesc : '',
      pageIndex: q.pageIndex,
      pageSize: q.pageSize,
    };
    return this.api
      .get<unknown>('rentals', { params, context: withSkipLoader() })
      .pipe(toPaged<RentalDto>());
  }

  get(id: string): Observable<RentalDetailDto> {
    return this.api.get<RentalDetailDto>(`rentals/${id}`, { context: withSkipLoader() });
  }

  start(body: StartRentalRequest): Observable<RentalDto> {
    return this.api.post<RentalDto>('rentals', body, { context: withSilentErrors() });
  }

  /** Ends the rental AND records the return inspection in one step. */
  returnMotorcycle(rentalId: string, body: ReturnMotorcycleRequest): Observable<InspectionDto> {
    return this.api.post<InspectionDto>(`rentals/${rentalId}/return`, body, {
      context: withSilentErrors(),
    });
  }

  cancel(id: string, body: CancelRentalRequest): Observable<RentalDto> {
    return this.api.post<RentalDto>(`rentals/${id}/cancel`, body, { context: withSilentErrors() });
  }

  updateTerms(id: string, body: UpdateRentalTermsRequest): Observable<RentalDto> {
    return this.api.put<RentalDto>(`rentals/${id}/terms`, body, { context: withSilentErrors() });
  }

  inspections(q: InspectionsQuery): Observable<PagedResponse<InspectionDto>> {
    return this.api
      .get<unknown>('inspections', { params: { ...q }, context: withSkipLoader() })
      .pipe(toPaged<InspectionDto>());
  }

  inspection(id: string): Observable<InspectionDto> {
    return this.api.get<InspectionDto>(`inspections/${id}`, { context: withSkipLoader() });
  }
}
