import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { PagedResponse } from '@core/models/api-response.model';
import { toPaged } from '@core/utils/api-list.util';
import { withSilentErrors, withSkipLoader } from '@core/http/http-context.tokens';
import {
  DecideRepairInvoiceRequest,
  RepairInvoiceDto,
  RepairInvoicesQuery,
} from '../models/repair-invoice.models';

/** Repair invoices (5.11). Stateless — screens hold the state. */
@Injectable({ providedIn: 'root' })
export class RepairInvoicesApi {
  private readonly api = inject(ApiService);

  list(q: RepairInvoicesQuery): Observable<PagedResponse<RepairInvoiceDto>> {
    return this.api
      .get<unknown>('repair-invoices', { params: { ...q }, context: withSkipLoader() })
      .pipe(toPaged<RepairInvoiceDto>());
  }

  /** Header counter — never toasts. */
  count(q: RepairInvoicesQuery): Observable<PagedResponse<RepairInvoiceDto>> {
    return this.api
      .get<unknown>('repair-invoices', {
        params: { ...q },
        context: withSilentErrors(withSkipLoader()),
      })
      .pipe(toPaged<RepairInvoiceDto>());
  }

  get(id: string): Observable<RepairInvoiceDto> {
    return this.api.get<RepairInvoiceDto>(`repair-invoices/${id}`, { context: withSkipLoader() });
  }

  decide(id: string, body: DecideRepairInvoiceRequest): Observable<RepairInvoiceDto> {
    return this.api.post<RepairInvoiceDto>(`repair-invoices/${id}/decision`, body, {
      context: withSilentErrors(),
    });
  }
}
