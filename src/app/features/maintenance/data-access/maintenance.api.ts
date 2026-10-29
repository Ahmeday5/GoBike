import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { PagedResponse } from '@core/models/api-response.model';
import { MaintenanceRecordDto } from '@core/models/domain.models';
import { toPaged } from '@core/utils/api-list.util';
import { withSilentErrors, withSkipLoader } from '@core/http/http-context.tokens';
import {
  CancelMaintenanceRequest,
  CompleteMaintenanceRequest,
  MaintenanceRecordsQuery,
  SaveMaintenanceRecordRequest,
  StartMaintenanceRequest,
  TechnicianReportRequest,
  VerifyRepairRequest,
} from '../models/maintenance.models';

/**
 * Maintenance records, technician report and supervisor verification (5.7).
 * Stateless — screens hold the state. Reads skip the global loader (screens
 * show skeletons); form submits are silent (forms render their own errors).
 */
@Injectable({ providedIn: 'root' })
export class MaintenanceApi {
  private readonly api = inject(ApiService);

  list(q: MaintenanceRecordsQuery): Observable<PagedResponse<MaintenanceRecordDto>> {
    return this.api
      .get<unknown>('maintenance/records', { params: { ...q }, context: withSkipLoader() })
      .pipe(toPaged<MaintenanceRecordDto>());
  }

  /** Same as `list` but never toasts — for header counters. */
  count(q: MaintenanceRecordsQuery): Observable<PagedResponse<MaintenanceRecordDto>> {
    return this.api
      .get<unknown>('maintenance/records', {
        params: { ...q },
        context: withSilentErrors(withSkipLoader()),
      })
      .pipe(toPaged<MaintenanceRecordDto>());
  }

  get(id: string): Observable<MaintenanceRecordDto> {
    return this.api.get<MaintenanceRecordDto>(`maintenance/records/${id}`, {
      context: withSkipLoader(),
    });
  }

  create(body: SaveMaintenanceRecordRequest): Observable<MaintenanceRecordDto> {
    return this.api.post<MaintenanceRecordDto>('maintenance/records', body, {
      context: withSilentErrors(),
    });
  }

  update(id: string, body: SaveMaintenanceRecordRequest): Observable<MaintenanceRecordDto> {
    return this.api.put<MaintenanceRecordDto>(`maintenance/records/${id}`, body, {
      context: withSilentErrors(),
    });
  }

  start(id: string, body: StartMaintenanceRequest = {}): Observable<MaintenanceRecordDto> {
    return this.api.post<MaintenanceRecordDto>(`maintenance/records/${id}/start`, body);
  }

  complete(id: string, body: CompleteMaintenanceRequest): Observable<MaintenanceRecordDto> {
    return this.api.post<MaintenanceRecordDto>(`maintenance/records/${id}/complete`, body, {
      context: withSilentErrors(),
    });
  }

  /** Used through `<app-reason-dialog>`, which renders the error itself. */
  cancel(id: string, body: CancelMaintenanceRequest): Observable<MaintenanceRecordDto> {
    return this.api.post<MaintenanceRecordDto>(`maintenance/records/${id}/cancel`, body, {
      context: withSilentErrors(),
    });
  }

  report(id: string, body: TechnicianReportRequest): Observable<MaintenanceRecordDto> {
    return this.api.put<MaintenanceRecordDto>(`maintenance/records/${id}/report`, body, {
      context: withSilentErrors(),
    });
  }

  /** Approve: the interceptor toasts failures. Reject goes through the reason dialog (silent). */
  verify(id: string, body: VerifyRepairRequest): Observable<MaintenanceRecordDto> {
    return this.api.post<MaintenanceRecordDto>(
      `maintenance/records/${id}/verify`,
      body,
      body.approved ? {} : { context: withSilentErrors() },
    );
  }
}
