import { DriverChargeSource, DriverChargeStatus, PaymentMethod } from '@core/constants/enums';

/*
 * Driver ledger (brief 5.10). Swagger types responses only as a generic
 * envelope, so these follow the brief; fields it doesn't promise are optional
 * and every screen renders them defensively.
 */

/** `GET /drivers/{id}/balance`. */
export interface DriverBalanceDto {
  driverId?: string;
  totalCharged: number;
  totalPaid: number;
  /** Unpaid debt — the number that matters. */
  outstanding: number;
  /** Paid in excess, waiting to settle future charges. */
  credit: number;
  /** Count of charges that are still (partly) unpaid. */
  openCharges: number;
}

export type StatementEntryType = 'Charge' | 'Payment';

export interface StatementEntryDto {
  atUtc: string;
  type: StatementEntryType;
  description?: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
  reference?: string | null;
}

/** `GET /drivers/{id}/statement` (normalized — the API may also return a bare array). */
export interface DriverStatementDto {
  driverId?: string;
  driverName?: string | null;
  entries: StatementEntryDto[];
}

export interface DriverChargeDto {
  id: string;
  driverId: string;
  driverName?: string | null;
  source: DriverChargeSource;
  status: DriverChargeStatus;
  amount: number;
  paidAmount?: number | null;
  remainingAmount?: number | null;
  description?: string | null;
  motorcycleId?: string | null;
  plateNumber?: string | null;
  chargedAtUtc?: string | null;
  createdAtUtc?: string | null;
  cancelledAtUtc?: string | null;
  cancelReason?: string | null;
}

export interface PaymentAllocationDto {
  chargeId?: string | null;
  chargeDescription?: string | null;
  description?: string | null;
  source?: DriverChargeSource | null;
  amount: number;
  /** What's left on the charge after this allocation. */
  chargeRemainingAmount?: number | null;
}

export interface DriverPaymentDto {
  id: string;
  driverId: string;
  amount: number;
  paidAtUtc: string;
  method: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
  allocatedAmount?: number | null;
  unallocatedAmount?: number | null;
  isVoided?: boolean;
  voidedAtUtc?: string | null;
  voidReason?: string | null;
  recordedByName?: string | null;
  allocations?: PaymentAllocationDto[] | null;
}

/**
 * `POST /drivers/{id}/payments` response. The brief only says it "shows
 * allocations", so accept either the payment itself or a wrapper.
 */
export interface RecordPaymentResponse extends Partial<DriverPaymentDto> {
  payment?: DriverPaymentDto | null;
  allocations?: PaymentAllocationDto[] | null;
  remainingCredit?: number | null;
  credit?: number | null;
  balance?: DriverBalanceDto | null;
}

/** What the record-payment dialog shows after success. */
export interface PaymentOutcome {
  amount: number;
  allocations: PaymentAllocationDto[];
  /** Part of this payment that settled no charge (kept as credit). */
  unallocated: number | null;
  /** Driver's total credit after the payment, if the API told us. */
  creditAfter: number | null;
}

/** `POST /drivers/{id}/payments` (Swagger: RecordDriverPaymentRequest). */
export interface RecordDriverPaymentRequest {
  amount: number;
  paidAtUtc?: string | null;
  method: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
}

/** `POST /drivers/{id}/charges` (Swagger: AddManualChargeRequest). */
export interface AddManualChargeRequest {
  amount: number;
  description: string;
  motorcycleId?: string | null;
}

/** `POST /driver-ledger/charges/{id}/cancel` and `/payments/{id}/void`. */
export interface LedgerReasonRequest {
  reason: string;
}

export interface ChargesQuery {
  status: DriverChargeStatus | '';
  source: DriverChargeSource | '';
  pageIndex: number;
  pageSize: number;
}

export interface PaymentsQuery {
  includeVoided: boolean;
  pageIndex: number;
  pageSize: number;
}
