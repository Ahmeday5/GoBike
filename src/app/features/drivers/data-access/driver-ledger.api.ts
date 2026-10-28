import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { PagedResponse } from '@core/models/api-response.model';
import { asList, toPaged } from '@core/utils/api-list.util';
import { withSilentErrors, withSkipLoader } from '@core/http/http-context.tokens';
import {
  AddManualChargeRequest,
  ChargesQuery,
  DriverBalanceDto,
  DriverChargeDto,
  DriverPaymentDto,
  DriverStatementDto,
  LedgerReasonRequest,
  PaymentsQuery,
  RecordDriverPaymentRequest,
  RecordPaymentResponse,
  StatementEntryDto,
} from '../models/ledger.models';

const READ = () => withSilentErrors(withSkipLoader());

/** Driver debts & payments (brief 5.10). Reads are silent — the account tab renders its own errors. */
@Injectable({ providedIn: 'root' })
export class DriverLedgerApi {
  private readonly api = inject(ApiService);

  balance(driverId: string): Observable<DriverBalanceDto> {
    return this.api.get<DriverBalanceDto>(`drivers/${driverId}/balance`, { context: READ() });
  }

  statement(driverId: string): Observable<DriverStatementDto> {
    return this.api
      .get<unknown>(`drivers/${driverId}/statement`, { context: READ() })
      .pipe(
        map((r) => ({
          ...(r && typeof r === 'object' && !Array.isArray(r) ? (r as DriverStatementDto) : {}),
          entries: asList<StatementEntryDto>(
            Array.isArray(r) ? r : (r as { entries?: unknown } | null)?.entries,
          ),
        })),
      );
  }

  charges(driverId: string, query: ChargesQuery): Observable<PagedResponse<DriverChargeDto>> {
    return this.api
      .get<unknown>(`drivers/${driverId}/charges`, { params: { ...query }, context: READ() })
      .pipe(toPaged<DriverChargeDto>());
  }

  payments(driverId: string, query: PaymentsQuery): Observable<PagedResponse<DriverPaymentDto>> {
    return this.api
      .get<unknown>(`drivers/${driverId}/payments`, { params: { ...query }, context: READ() })
      .pipe(toPaged<DriverPaymentDto>());
  }

  charge(id: string): Observable<DriverChargeDto> {
    return this.api.get<DriverChargeDto>(`driver-ledger/charges/${id}`, { context: READ() });
  }

  recordPayment(
    driverId: string,
    body: RecordDriverPaymentRequest,
  ): Observable<RecordPaymentResponse> {
    return this.api.post<RecordPaymentResponse>(`drivers/${driverId}/payments`, body, {
      context: withSilentErrors(),
    });
  }

  addManualCharge(driverId: string, body: AddManualChargeRequest): Observable<DriverChargeDto> {
    return this.api.post<DriverChargeDto>(`drivers/${driverId}/charges`, body, {
      context: withSilentErrors(),
    });
  }

  cancelCharge(id: string, body: LedgerReasonRequest): Observable<unknown> {
    return this.api.post(`driver-ledger/charges/${id}/cancel`, body, {
      context: withSilentErrors(),
    });
  }

  voidPayment(id: string, body: LedgerReasonRequest): Observable<unknown> {
    return this.api.post(`driver-ledger/payments/${id}/void`, body, {
      context: withSilentErrors(),
    });
  }
}
