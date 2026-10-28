/**
 * Response DTOs shared by more than one feature. Request bodies are typed per
 * feature next to their API service (they mirror Swagger exactly).
 *
 * Swagger only types responses as a generic envelope, so these shapes follow
 * the API brief; optional fields are ones the brief doesn't guarantee.
 * Dates are UTC ISO strings (`…Utc`); DateOnly fields are `yyyy-MM-dd`.
 */
import {
  DocumentCategory,
  DocumentOwnerType,
  DriverStatus,
  FaultSeverity,
  InspectionResult,
  MaintenanceStatus,
  MaintenanceType,
  MotorcycleHealth,
  MotorcycleStatus,
  OilChangeSubmissionStatus,
  RentPeriod,
  RentalStatus,
} from '../constants/enums';

// ─────────────────────────── Fleet ───────────────────────────

export interface MotorcycleDto {
  id: string;
  plateNumber: string;
  internalCode?: string | null;
  brand: string;
  model: string;
  manufacturingYear?: number | null;
  color?: string | null;
  chassisNumber?: string | null;
  engineNumber?: string | null;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
  preparationCost?: number | null;
  equipmentCost?: number | null;
  officeId: string;
  officeName?: string | null;
  supervisorUserId?: string | null;
  supervisorName?: string | null;
  maintenancePolicyId?: string | null;
  notes?: string | null;
  status: MotorcycleStatus;
  health?: MotorcycleHealth | null;
  hasGpsDevice?: boolean;
  allowedStatusChanges?: MotorcycleStatus[];
  /** Optimistic-concurrency token: send back on PUT; 409 means someone else edited. */
  rowVersion?: string | null;
  createdAtUtc?: string | null;
}

// ─────────────────────────── Drivers ───────────────────────────

export interface DriverDto {
  id: string;
  fullName: string;
  phoneNumber: string;
  nationalId?: string | null;
  licenseNumber?: string | null;
  licenseExpiryDate?: string | null;
  address?: string | null;
  officeId: string;
  officeName?: string | null;
  supervisorUserId?: string | null;
  supervisorName?: string | null;
  status: DriverStatus;
  /** Why the driver isn't active (cleared on reactivation). */
  statusReason?: string | null;
  /** Has a password → can log in to the mobile app. */
  hasAppAccess: boolean;
  lastLoginAtUtc?: string | null;
  /** Registered a push device → notifications can reach them. */
  hasPushDevice?: boolean;
  lastAppSeenAtUtc?: string | null;
  hasActiveAssignment?: boolean;
  createdAtUtc?: string | null;
}

/** Shown ONCE after creating a driver account or resetting its password. */
export interface DriverCredentials {
  driverId?: string;
  loginPhone: string;
  password: string;
  generated: boolean;
}

// ─────────────────────────── Rentals & inspections ───────────────────────────

export interface RentalDto {
  id: string;
  motorcycleId: string;
  plateNumber?: string | null;
  driverId: string;
  driverName?: string | null;
  driverPhone?: string | null;
  officeId?: string | null;
  officeName?: string | null;
  status: RentalStatus;
  startAtUtc: string;
  endAtUtc?: string | null;
  contractNumber?: string | null;
  rentAmount: number;
  rentPeriod: RentPeriod;
  depositAmount: number;
  terms?: string | null;
  notes?: string | null;
  /** Until when the rental can still be cancelled. */
  cancellableUntilUtc?: string | null;
  canCancel?: boolean;
}

export interface FaultDto {
  id?: string | null;
  description: string;
  severity: FaultSeverity;
  isFixed?: boolean;
}

export interface InspectionDto {
  id: string;
  rentalId?: string | null;
  motorcycleId: string;
  plateNumber?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  result: InspectionResult;
  faultSummary?: string | null;
  faults?: FaultDto[];
  notes?: string | null;
  inspectedAtUtc?: string | null;
  returnedAtUtc?: string | null;
  inspectedByName?: string | null;
  maintenanceRecordId?: string | null;
}

// ─────────────────────────── Maintenance ───────────────────────────

export interface PartDto {
  id?: string | null;
  partName: string;
  partNumber?: string | null;
  quantity: number;
  unitCost: number;
  totalCost?: number | null;
}

export interface MaintenanceRecordDto {
  id: string;
  motorcycleId: string;
  plateNumber?: string | null;
  officeId?: string | null;
  type: MaintenanceType;
  status: MaintenanceStatus;
  scheduledAtUtc?: string | null;
  startedAtUtc?: string | null;
  completedAtUtc?: string | null;
  issueDescription?: string | null;
  workPerformed?: string | null;
  workshop?: string | null;
  technician?: string | null;
  laborCost?: number | null;
  otherCost?: number | null;
  partsCost?: number | null;
  totalCost?: number | null;
  notes?: string | null;
  faults?: FaultDto[];
  parts?: PartDto[];
  /** Came from a return inspection → needs supervisor verification. */
  requiresSupervisorApproval?: boolean;
  inspectionId?: string | null;
  reportedAtUtc?: string | null;
  verifiedAtUtc?: string | null;
  /** Shown prominently to the technician when the supervisor rejected the repair. */
  verificationRejectReason?: string | null;
  resetsMaintenanceCycle?: boolean | null;
  rowVersion?: string | null;
}

// ─────────────────────────── Oil changes ───────────────────────────

export interface OilChangeSubmissionDto {
  id: string;
  motorcycleId: string;
  plateNumber?: string | null;
  driverId: string;
  driverName?: string | null;
  officeId?: string | null;
  status: OilChangeSubmissionStatus;
  submittedAtUtc: string;
  kmAtSubmit: number;
  odometerKmAtSubmit?: number | null;
  driverNotes?: string | null;
  videoAvailable: boolean;
  videoFileName?: string | null;
  videoSizeBytes?: number | null;
  rejectReason?: string | null;
  reviewedAtUtc?: string | null;
  reviewedByName?: string | null;
  finedKm?: number | null;
  fineRatePerKm?: number | null;
  fineAmount?: number | null;
}

// ─────────────────────────── Documents ───────────────────────────

export interface DocumentDto {
  id: string;
  ownerType: DocumentOwnerType;
  ownerId: string;
  ownerName?: string | null;
  category: DocumentCategory;
  title?: string | null;
  fileName?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  expiryDate?: string | null;
  isExpired?: boolean;
  daysToExpiry?: number | null;
  notes?: string | null;
  uploadedAtUtc?: string | null;
  createdAtUtc?: string | null;
}

// ─────────────────────────── Administration (lookups) ───────────────────────────

export interface OfficeDto {
  id: string;
  name: string;
  code?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  managerUserId?: string | null;
  managerName?: string | null;
  isActive: boolean;
  notes?: string | null;
}

export interface StaffUserDto {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string | null;
  officeId?: string | null;
  officeName?: string | null;
  roles: string[];
  isActive: boolean;
  lastLoginAtUtc?: string | null;
  createdAtUtc?: string | null;
}
