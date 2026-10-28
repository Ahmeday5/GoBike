/**
 * Every backend enum: its string values (as typed unions), Arabic label,
 * a visual tone and an icon. This is the ONLY place enum values are
 * translated — screens render them through `<app-enum-chip>` or `enumLabel()`.
 *
 * Values mirror Swagger exactly (enums are strings on the wire).
 */

/** Semantic color of a chip. Never the only signal: every chip also shows text + an icon. */
export type Tone = 'success' | 'danger' | 'warning' | 'orange' | 'info' | 'neutral' | 'purple';

export interface EnumMeta {
  label: string;
  tone: Tone;
  /** Icon name understood by `<app-icon>` (kept as a string so core stays UI-agnostic). */
  icon?: string;
}

type EnumMap<T extends string> = Readonly<Record<T, EnumMeta>>;

const define = <T extends string>(map: Record<T, EnumMeta>): EnumMap<T> => map;

// ─────────────────────────── Fleet ───────────────────────────

export type MotorcycleStatus =
  'Available' | 'Rented' | 'UnderMaintenance' | 'Damaged' | 'Suspended' | 'Retired';
export const MOTORCYCLE_STATUS = define<MotorcycleStatus>({
  Available: { label: 'متاحة', tone: 'success', icon: 'check-circle' },
  Rented: { label: 'مؤجرة', tone: 'info', icon: 'route' },
  UnderMaintenance: { label: 'تحت الصيانة', tone: 'warning', icon: 'wrench' },
  Damaged: { label: 'متضررة', tone: 'danger', icon: 'alert' },
  Suspended: { label: 'موقوفة', tone: 'neutral', icon: 'pause' },
  Retired: { label: 'خارج الخدمة', tone: 'neutral', icon: 'archive' },
});

export type MotorcycleHealth = 'Green' | 'Red';
export const MOTORCYCLE_HEALTH = define<MotorcycleHealth>({
  Green: { label: 'سليمة', tone: 'success', icon: 'check-circle' },
  Red: { label: 'بها مشكلة', tone: 'danger', icon: 'alert' },
});

export type GpsConnectivityStatus =
  'Unknown' | 'NeverOnline' | 'Online' | 'Expired' | 'Offline' | 'Blocked';
export const GPS_CONNECTIVITY = define<GpsConnectivityStatus>({
  Unknown: { label: 'غير معروف', tone: 'neutral', icon: 'help' },
  NeverOnline: { label: 'لم يتصل مطلقًا', tone: 'neutral', icon: 'wifi-off' },
  Online: { label: 'متصل', tone: 'success', icon: 'wifi' },
  Expired: { label: 'منتهي الاشتراك', tone: 'warning', icon: 'clock' },
  Offline: { label: 'غير متصل', tone: 'danger', icon: 'wifi-off' },
  Blocked: { label: 'محظور', tone: 'danger', icon: 'ban' },
});

/** Oil level as reported on the map / overview (`none` = below the first threshold). */
export type OilLevel = 'None' | 'FirstWarning' | 'SecondWarning' | 'Critical' | 'Overdue';
export const OIL_LEVEL = define<OilLevel>({
  None: { label: 'طبيعي', tone: 'success', icon: 'droplet' },
  FirstWarning: { label: 'تنبيه أول', tone: 'warning', icon: 'droplet' },
  SecondWarning: { label: 'تنبيه ثانٍ', tone: 'warning', icon: 'droplet' },
  Critical: { label: 'حرج', tone: 'orange', icon: 'droplet' },
  Overdue: { label: 'متجاوز الحد', tone: 'danger', icon: 'droplet' },
});

// ─────────────────────────── Drivers & rentals ───────────────────────────

export type DriverStatus = 'Active' | 'Suspended' | 'Inactive' | 'Blacklisted';
export const DRIVER_STATUS = define<DriverStatus>({
  Active: { label: 'نشط', tone: 'success', icon: 'check-circle' },
  Suspended: { label: 'موقوف', tone: 'warning', icon: 'pause' },
  Inactive: { label: 'غير نشط', tone: 'neutral', icon: 'minus-circle' },
  Blacklisted: { label: 'محظور', tone: 'danger', icon: 'ban' },
});

export type RentalStatus = 'Active' | 'Ended' | 'Cancelled';
export const RENTAL_STATUS = define<RentalStatus>({
  Active: { label: 'سارٍ', tone: 'info', icon: 'route' },
  Ended: { label: 'منتهٍ', tone: 'neutral', icon: 'check-circle' },
  Cancelled: { label: 'ملغى', tone: 'danger', icon: 'close' },
});

export type RentPeriod = 'Daily' | 'Weekly' | 'Monthly';
export const RENT_PERIOD = define<RentPeriod>({
  Daily: { label: 'يومي', tone: 'neutral' },
  Weekly: { label: 'أسبوعي', tone: 'neutral' },
  Monthly: { label: 'شهري', tone: 'neutral' },
});

export type InspectionResult = 'Ok' | 'HasFaults';
export const INSPECTION_RESULT = define<InspectionResult>({
  Ok: { label: 'سليمة', tone: 'success', icon: 'check-circle' },
  HasFaults: { label: 'بها أعطال', tone: 'danger', icon: 'alert' },
});

export type FaultSeverity = 'Minor' | 'Major' | 'Critical';
export const FAULT_SEVERITY = define<FaultSeverity>({
  Minor: { label: 'بسيط', tone: 'warning', icon: 'info' },
  Major: { label: 'جسيم', tone: 'orange', icon: 'alert' },
  Critical: { label: 'حرج', tone: 'danger', icon: 'alert' },
});

// ─────────────────────────── Maintenance ───────────────────────────

export type MaintenanceStatus =
  'Scheduled' | 'InProgress' | 'Completed' | 'Cancelled' | 'AwaitingSupervisorApproval';
export const MAINTENANCE_STATUS = define<MaintenanceStatus>({
  Scheduled: { label: 'مجدولة', tone: 'neutral', icon: 'calendar' },
  InProgress: { label: 'جارية', tone: 'info', icon: 'wrench' },
  Completed: { label: 'مكتملة', tone: 'success', icon: 'check-circle' },
  Cancelled: { label: 'ملغاة', tone: 'neutral', icon: 'close' },
  AwaitingSupervisorApproval: { label: 'بانتظار اعتماد المشرف', tone: 'purple', icon: 'shield' },
});

export type MaintenanceType =
  'Periodic' | 'Repair' | 'Inspection' | 'Emergency' | 'AccidentRepair' | 'Other';
export const MAINTENANCE_TYPE = define<MaintenanceType>({
  Periodic: { label: 'دورية', tone: 'neutral', icon: 'calendar' },
  Repair: { label: 'إصلاح', tone: 'info', icon: 'wrench' },
  Inspection: { label: 'فحص', tone: 'neutral', icon: 'search' },
  Emergency: { label: 'طارئة', tone: 'danger', icon: 'alert' },
  AccidentRepair: { label: 'إصلاح حادث', tone: 'orange', icon: 'alert' },
  Other: { label: 'أخرى', tone: 'neutral' },
});

export type MaintenanceAlertLevel = 'FirstWarning' | 'SecondWarning' | 'Critical' | 'Overdue';
export const MAINTENANCE_ALERT_LEVEL = define<MaintenanceAlertLevel>({
  FirstWarning: { label: 'تنبيه أول', tone: 'warning', icon: 'droplet' },
  SecondWarning: { label: 'تنبيه ثانٍ', tone: 'warning', icon: 'droplet' },
  Critical: { label: 'حرج', tone: 'orange', icon: 'droplet' },
  Overdue: { label: 'متجاوز الحد', tone: 'danger', icon: 'droplet' },
});

export type MaintenanceAlertStatus = 'Open' | 'Acknowledged' | 'Resolved' | 'Superseded';
export const MAINTENANCE_ALERT_STATUS = define<MaintenanceAlertStatus>({
  Open: { label: 'مفتوح', tone: 'danger', icon: 'bell' },
  Acknowledged: { label: 'تم الاطلاع', tone: 'info', icon: 'eye' },
  Resolved: { label: 'تم الحل', tone: 'success', icon: 'check-circle' },
  Superseded: { label: 'حلّ محله تنبيه أحدث', tone: 'neutral', icon: 'minus-circle' },
});

export type OilChangeSubmissionStatus = 'Pending' | 'Approved' | 'Rejected' | 'Expired';
export const OIL_CHANGE_STATUS = define<OilChangeSubmissionStatus>({
  Pending: { label: 'بانتظار المراجعة', tone: 'warning', icon: 'clock' },
  Approved: { label: 'مقبول', tone: 'success', icon: 'check-circle' },
  Rejected: { label: 'مرفوض', tone: 'danger', icon: 'close' },
  Expired: { label: 'انتهت مهلته', tone: 'neutral', icon: 'clock' },
});

export type AlertRecipient =
  'None' | 'Driver' | 'Admin' | 'TechnicalSupport' | 'MaintenanceOfficer' | 'Accountant';
export const ALERT_RECIPIENT = define<AlertRecipient>({
  None: { label: 'لا أحد', tone: 'neutral' },
  Driver: { label: 'السائق', tone: 'neutral' },
  Admin: { label: 'الأدمن', tone: 'neutral' },
  TechnicalSupport: { label: 'الدعم الفني', tone: 'neutral' },
  MaintenanceOfficer: { label: 'مسئول الصيانة', tone: 'neutral' },
  Accountant: { label: 'مسئول الحسابات', tone: 'neutral' },
});

// ─────────────────────────── GPS ───────────────────────────

export type GpsIncidentType =
  | 'DeviceOffline'
  | 'NoRecentLocation'
  | 'PowerDisconnected'
  | 'SuspectedPowerDisconnect'
  | 'LowBattery'
  | 'ProviderOutage'
  | 'OutOfZone';
export const GPS_INCIDENT_TYPE = define<GpsIncidentType>({
  DeviceOffline: { label: 'الجهاز غير متصل', tone: 'danger', icon: 'wifi-off' },
  NoRecentLocation: { label: 'لا يوجد موقع حديث', tone: 'warning', icon: 'map-pin' },
  PowerDisconnected: { label: 'فصل الكهرباء', tone: 'danger', icon: 'power' },
  SuspectedPowerDisconnect: { label: 'فصل كهرباء (مشتبه)', tone: 'orange', icon: 'power' },
  LowBattery: { label: 'بطارية منخفضة', tone: 'warning', icon: 'battery' },
  ProviderOutage: { label: 'عطل لدى مزود الخدمة', tone: 'neutral', icon: 'cloud-off' },
  OutOfZone: { label: 'خارج النطاق', tone: 'danger', icon: 'target' },
});

export type IncidentStatus = 'Open' | 'Acknowledged' | 'Resolved';
export const INCIDENT_STATUS = define<IncidentStatus>({
  Open: { label: 'مفتوح', tone: 'danger', icon: 'bell' },
  Acknowledged: { label: 'تم الاطلاع', tone: 'info', icon: 'eye' },
  Resolved: { label: 'تم الحل', tone: 'success', icon: 'check-circle' },
});

// ─────────────────────────── Money ───────────────────────────

export type DriverChargeSource = 'RepairInvoice' | 'OilOverdueFine' | 'Manual';
export const DRIVER_CHARGE_SOURCE = define<DriverChargeSource>({
  RepairInvoice: { label: 'فاتورة إصلاح', tone: 'info', icon: 'wrench' },
  OilOverdueFine: { label: 'غرامة تأخير تغيير الزيت', tone: 'orange', icon: 'droplet' },
  Manual: { label: 'مديونية يدوية', tone: 'neutral', icon: 'edit' },
});

export type DriverChargeStatus = 'Open' | 'PartiallyPaid' | 'Paid' | 'Cancelled';
export const DRIVER_CHARGE_STATUS = define<DriverChargeStatus>({
  Open: { label: 'غير مسددة', tone: 'danger', icon: 'clock' },
  PartiallyPaid: { label: 'مسددة جزئيًا', tone: 'warning', icon: 'pie' },
  Paid: { label: 'مسددة', tone: 'success', icon: 'check-circle' },
  Cancelled: { label: 'ملغاة', tone: 'neutral', icon: 'close' },
});

export type RepairInvoiceStatus =
  'PendingDecision' | 'ChargedToDriver' | 'CompanyExpense' | 'Cancelled';
export const REPAIR_INVOICE_STATUS = define<RepairInvoiceStatus>({
  PendingDecision: { label: 'بانتظار القرار', tone: 'warning', icon: 'clock' },
  ChargedToDriver: { label: 'على السائق', tone: 'info', icon: 'user' },
  CompanyExpense: { label: 'على الشركة', tone: 'purple', icon: 'building' },
  Cancelled: { label: 'ملغاة', tone: 'neutral', icon: 'close' },
});

export type RepairInvoicePayer = 'Driver' | 'Company';
export const REPAIR_INVOICE_PAYER = define<RepairInvoicePayer>({
  Driver: { label: 'السائق', tone: 'info', icon: 'user' },
  Company: { label: 'الشركة', tone: 'purple', icon: 'building' },
});

export type PaymentMethod = 'Cash' | 'BankTransfer' | 'Card' | 'MobileWallet' | 'Cheque' | 'Other';
export const PAYMENT_METHOD = define<PaymentMethod>({
  Cash: { label: 'نقدي', tone: 'neutral', icon: 'cash' },
  BankTransfer: { label: 'تحويل بنكي', tone: 'neutral', icon: 'building' },
  Card: { label: 'بطاقة', tone: 'neutral', icon: 'card' },
  MobileWallet: { label: 'محفظة إلكترونية', tone: 'neutral', icon: 'phone' },
  Cheque: { label: 'شيك', tone: 'neutral', icon: 'file' },
  Other: { label: 'أخرى', tone: 'neutral' },
});

// ─────────────────────────── Notifications ───────────────────────────

export type NotificationSeverity = 'Info' | 'Warning' | 'Critical';
export const NOTIFICATION_SEVERITY = define<NotificationSeverity>({
  Info: { label: 'معلومة', tone: 'info', icon: 'info' },
  Warning: { label: 'تحذير', tone: 'warning', icon: 'alert' },
  Critical: { label: 'حرج', tone: 'danger', icon: 'alert' },
});

export type DeliveryStatus = 'Pending' | 'Sent' | 'Failed' | 'Skipped';
export const DELIVERY_STATUS = define<DeliveryStatus>({
  Pending: { label: 'قيد الإرسال', tone: 'warning', icon: 'clock' },
  Sent: { label: 'تم الإرسال', tone: 'success', icon: 'check-circle' },
  Failed: { label: 'فشل', tone: 'danger', icon: 'close' },
  Skipped: { label: 'تم تخطيه', tone: 'neutral', icon: 'minus-circle' },
});

export type NotificationType =
  | 'General'
  | 'MaintenanceWarning'
  | 'MaintenanceCritical'
  | 'GpsOffline'
  | 'PowerDisconnected'
  | 'SuspectedPowerDisconnect'
  | 'LowBattery'
  | 'ProviderOutage'
  | 'DocumentExpiring'
  | 'InvoiceIssued'
  | 'InvoiceOverdue'
  | 'PaymentReceived'
  | 'IncidentUpdate'
  | 'RentalUpdate'
  | 'OilChangeOverdue'
  | 'OilChangeReview'
  | 'ZoneExit'
  | 'InspectionUpdate'
  | 'DriverCharge'
  | 'DriverPayment'
  | 'RepairInvoice';
export const NOTIFICATION_TYPE = define<NotificationType>({
  General: { label: 'عام', tone: 'neutral', icon: 'bell' },
  MaintenanceWarning: { label: 'تنبيه صيانة', tone: 'warning', icon: 'droplet' },
  MaintenanceCritical: { label: 'صيانة حرجة', tone: 'danger', icon: 'droplet' },
  GpsOffline: { label: 'جهاز تتبع غير متصل', tone: 'danger', icon: 'wifi-off' },
  PowerDisconnected: { label: 'فصل الكهرباء', tone: 'danger', icon: 'power' },
  SuspectedPowerDisconnect: { label: 'فصل كهرباء (مشتبه)', tone: 'orange', icon: 'power' },
  LowBattery: { label: 'بطارية منخفضة', tone: 'warning', icon: 'battery' },
  ProviderOutage: { label: 'عطل لدى مزود التتبع', tone: 'neutral', icon: 'cloud-off' },
  DocumentExpiring: { label: 'مستند قارب على الانتهاء', tone: 'warning', icon: 'file' },
  InvoiceIssued: { label: 'فاتورة جديدة', tone: 'info', icon: 'file' },
  InvoiceOverdue: { label: 'فاتورة متأخرة', tone: 'danger', icon: 'file' },
  PaymentReceived: { label: 'دفعة مستلمة', tone: 'success', icon: 'cash' },
  IncidentUpdate: { label: 'تحديث حادثة', tone: 'info', icon: 'alert' },
  RentalUpdate: { label: 'تحديث إيجار', tone: 'info', icon: 'route' },
  OilChangeOverdue: { label: 'تأخر تغيير الزيت', tone: 'danger', icon: 'droplet' },
  OilChangeReview: { label: 'فيديو تغيير زيت للمراجعة', tone: 'warning', icon: 'video' },
  ZoneExit: { label: 'خروج من النطاق', tone: 'danger', icon: 'target' },
  InspectionUpdate: { label: 'تحديث فحص', tone: 'info', icon: 'search' },
  DriverCharge: { label: 'مديونية على سائق', tone: 'orange', icon: 'cash' },
  DriverPayment: { label: 'دفعة من سائق', tone: 'success', icon: 'cash' },
  RepairInvoice: { label: 'فاتورة إصلاح', tone: 'info', icon: 'wrench' },
});

// ─────────────────────────── Documents ───────────────────────────

export type DocumentOwnerType =
  | 'Motorcycle'
  | 'Driver'
  | 'RentalAssignment'
  | 'Accident'
  | 'Violation'
  | 'MaintenanceRecord'
  | 'Expense'
  | 'Invoice'
  | 'Office';
export const DOCUMENT_OWNER_TYPE = define<DocumentOwnerType>({
  Motorcycle: { label: 'موتوسيكل', tone: 'neutral', icon: 'bike' },
  Driver: { label: 'سائق', tone: 'neutral', icon: 'user' },
  RentalAssignment: { label: 'إيجار', tone: 'neutral', icon: 'route' },
  Accident: { label: 'حادث', tone: 'neutral', icon: 'alert' },
  Violation: { label: 'مخالفة', tone: 'neutral', icon: 'ban' },
  MaintenanceRecord: { label: 'صيانة', tone: 'neutral', icon: 'wrench' },
  Expense: { label: 'مصروف', tone: 'neutral', icon: 'cash' },
  Invoice: { label: 'فاتورة', tone: 'neutral', icon: 'file' },
  Office: { label: 'مكتب', tone: 'neutral', icon: 'building' },
});

export type DocumentCategory =
  | 'Photo'
  | 'Registration'
  | 'License'
  | 'NationalId'
  | 'Contract'
  | 'Insurance'
  | 'Evidence'
  | 'Receipt'
  | 'Invoice'
  | 'Other';
export const DOCUMENT_CATEGORY = define<DocumentCategory>({
  Photo: { label: 'صورة', tone: 'neutral', icon: 'image' },
  Registration: { label: 'رخصة المركبة', tone: 'neutral', icon: 'file' },
  License: { label: 'رخصة القيادة', tone: 'neutral', icon: 'card' },
  NationalId: { label: 'بطاقة الرقم القومي', tone: 'neutral', icon: 'card' },
  Contract: { label: 'عقد', tone: 'neutral', icon: 'file' },
  Insurance: { label: 'تأمين', tone: 'neutral', icon: 'shield' },
  Evidence: { label: 'دليل', tone: 'neutral', icon: 'search' },
  Receipt: { label: 'إيصال', tone: 'neutral', icon: 'file' },
  Invoice: { label: 'فاتورة', tone: 'neutral', icon: 'file' },
  Other: { label: 'أخرى', tone: 'neutral', icon: 'file' },
});

// ─────────────────────────── Roles ───────────────────────────

export type StaffRole = 'Admin' | 'TechnicalSupport' | 'MaintenanceOfficer' | 'Accountant';
export const STAFF_ROLE = define<StaffRole>({
  Admin: { label: 'ادمن', tone: 'danger', icon: 'shield' },
  TechnicalSupport: { label: 'دعم فني', tone: 'info', icon: 'map-pin' },
  MaintenanceOfficer: { label: 'مسئول صيانة', tone: 'warning', icon: 'wrench' },
  Accountant: { label: 'مسئول حسابات', tone: 'success', icon: 'cash' },
});

// ─────────────────────────── helpers ───────────────────────────

const FALLBACK: EnumMeta = { label: '—', tone: 'neutral' };

/** Meta for a value, tolerating unknown/new backend values (shown raw, neutral). */
export function enumMeta<T extends string>(
  map: EnumMap<T>,
  value: string | null | undefined,
): EnumMeta {
  if (!value) return FALLBACK;
  return (map as Record<string, EnumMeta>)[value] ?? { label: value, tone: 'neutral' };
}

export function enumLabel<T extends string>(
  map: EnumMap<T>,
  value: string | null | undefined,
): string {
  return enumMeta(map, value).label;
}

export interface EnumOption<T extends string = string> {
  value: T;
  label: string;
}

/** `<select>` options in declaration order. */
export function enumOptions<T extends string>(map: EnumMap<T>): EnumOption<T>[] {
  return (Object.keys(map) as T[]).map((value) => ({ value, label: map[value].label }));
}
