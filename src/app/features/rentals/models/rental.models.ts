import {
  FaultSeverity,
  InspectionResult,
  RentPeriod,
  RentalStatus,
} from '@core/constants/enums';
import { InspectionDto, RentalDto } from '@core/models/domain.models';

/**
 * URL-backed rentals filters (`GET /rentals`). Dates are Cairo calendar days
 * (`yyyy-MM-dd`) in the URL and become a UTC window when sent.
 */
export type RentalsQuery = {
  search: string;
  status: RentalStatus | '';
  officeId: string;
  motorcycleId: string;
  driverId: string;
  from: string;
  to: string;
  sortBy: 'startAt' | 'endAt' | 'status' | 'rentAmount' | '';
  sortDesc: boolean;
  pageIndex: number;
  pageSize: number;
};

export const RENTALS_QUERY_DEFAULTS: RentalsQuery = {
  search: '',
  status: '',
  officeId: '',
  motorcycleId: '',
  driverId: '',
  from: '',
  to: '',
  sortBy: '',
  sortDesc: false,
  pageIndex: 1,
  pageSize: 20,
};

/** `GET /inspections` filters (Swagger has no search/sort here). */
export type InspectionsQuery = {
  result: InspectionResult | '';
  officeId: string;
  motorcycleId: string;
  driverId: string;
  pageIndex: number;
  pageSize: number;
};

export const INSPECTIONS_QUERY_DEFAULTS: InspectionsQuery = {
  result: '',
  officeId: '',
  motorcycleId: '',
  driverId: '',
  pageIndex: 1,
  pageSize: 20,
};

/** Swagger: StartRentalRequest. */
export interface StartRentalRequest {
  motorcycleId: string;
  driverId: string;
  startAtUtc?: string | null;
  contractNumber?: string | null;
  rentAmount: number;
  rentPeriod: RentPeriod;
  depositAmount: number;
  terms?: string | null;
  notes?: string | null;
}

/** Swagger: UpdateRentalTermsRequest. */
export interface UpdateRentalTermsRequest {
  contractNumber?: string | null;
  rentAmount: number;
  rentPeriod: RentPeriod;
  depositAmount: number;
  terms?: string | null;
  notes?: string | null;
}

/** Swagger: CancelRentalRequest. */
export interface CancelRentalRequest {
  reason: string;
}

/** Swagger: ReturnMotorcycleRequest (faults are MaintenanceFaultDto without isFixed). */
export interface ReturnMotorcycleRequest {
  returnedAtUtc?: string | null;
  result: InspectionResult;
  faultSummary?: string | null;
  faults: { description: string; severity: FaultSeverity }[];
  notes?: string | null;
}

/**
 * Rental as returned by `GET /rentals/{id}`. The brief doesn't spell out the
 * detail shape, so the extra fields are optional and rendered defensively.
 */
export interface RentalDetailDto extends RentalDto {
  motorcycleBrand?: string | null;
  motorcycleModel?: string | null;
  returnedAtUtc?: string | null;
  cancelledAtUtc?: string | null;
  cancelReason?: string | null;
  createdByName?: string | null;
  createdAtUtc?: string | null;
  inspectionId?: string | null;
  inspection?: InspectionDto | null;
}
