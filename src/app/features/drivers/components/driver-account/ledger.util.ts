import {
  DriverChargeDto,
  DriverPaymentDto,
  PaymentAllocationDto,
  PaymentOutcome,
  RecordPaymentResponse,
} from '../../models/ledger.models';

/** Unpaid part of a charge (`remainingAmount` when the API sends it). */
export function chargeRemaining(c: DriverChargeDto): number {
  if (c.status === 'Cancelled' || c.status === 'Paid') return 0;
  return c.remainingAmount ?? Math.max(0, c.amount - (c.paidAmount ?? 0));
}

/** Only an untouched charge can be cancelled (brief 5.10: "only if unpaid"). */
export function canCancelCharge(c: DriverChargeDto): boolean {
  return c.status === 'Open' && !(c.paidAmount ?? 0);
}

/**
 * `POST /drivers/{id}/payments` answers either the payment or a wrapper —
 * normalise it to what the dialog shows. Nothing is invented: when the API
 * doesn't say where the money went, `unallocated`/`creditAfter` stay null.
 */
export function toPaymentOutcome(res: RecordPaymentResponse | null, sent: number): PaymentOutcome {
  const payment: Partial<DriverPaymentDto> = res?.payment ?? res ?? {};
  const listed = res?.allocations ?? payment.allocations ?? null;
  const allocations: PaymentAllocationDto[] = listed ?? [];
  const amount = payment.amount ?? sent;
  const allocated = allocations.reduce((sum, a) => sum + (a.amount ?? 0), 0);
  const unallocated =
    payment.unallocatedAmount ?? (listed ? Math.max(0, round2(amount - allocated)) : null);
  return {
    amount,
    allocations,
    unallocated,
    creditAfter: res?.credit ?? res?.remainingCredit ?? res?.balance?.credit ?? null,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
