import { PERMISSIONS } from '@core/auth/constants/permissions';

const P = PERMISSIONS;

export interface PermissionGroupMeta {
  label: string;
  icon: string;
}

/** Permission prefix (text before the first dot) → Arabic group heading. Order = display order. */
export const PERMISSION_GROUPS: Record<string, PermissionGroupMeta> = {
  gps: { label: 'التتبع والخريطة', icon: 'map' },
  motorcycles: { label: 'الموتوسيكلات', icon: 'bike' },
  drivers: { label: 'السائقون', icon: 'users' },
  assignments: { label: 'الإيجارات', icon: 'route' },
  inspections: { label: 'فحوصات الاستلام', icon: 'search' },
  maintenance: { label: 'الصيانة وتغيير الزيت', icon: 'wrench' },
  alerts: { label: 'تنبيهات الزيت', icon: 'droplet' },
  incidents: { label: 'حوادث التتبع', icon: 'alert' },
  driver_ledger: { label: 'حسابات السائقين', icon: 'cash' },
  driver_payments: { label: 'مدفوعات السائقين', icon: 'card' },
  repair_invoices: { label: 'فواتير الإصلاح', icon: 'file' },
  documents: { label: 'المستندات', icon: 'archive' },
  users: { label: 'المستخدمون', icon: 'user' },
  roles: { label: 'الأدوار', icon: 'shield' },
  offices: { label: 'المكاتب', icon: 'building' },
  integrations: { label: 'التكاملات', icon: 'pulse' },
};

/** Permission → what it lets a user do (Arabic). Unknown permissions are shown by their raw name. */
export const PERMISSION_LABELS: Record<string, string> = {
  [P.Gps.Read]: 'عرض الخريطة والمواقع المباشرة',
  [P.Gps.History]: 'مسارات الرحلات السابقة وإنذارات الجهاز',
  [P.Gps.Manage]: 'تسجيل أجهزة التتبع وربطها وفكها',
  [P.Motorcycles.Read]: 'عرض الموتوسيكلات وبياناتها',
  [P.Motorcycles.Manage]: 'إضافة الموتوسيكلات وتعديلها',
  [P.Motorcycles.ChangeStatus]: 'تغيير حالة الموتوسيكل',
  [P.Motorcycles.Transfer]: 'نقل الموتوسيكل بين المكاتب',
  [P.Motorcycles.Zone]: 'تحديد النطاق الجغرافي للموتوسيكل',
  [P.Drivers.Read]: 'عرض السائقين',
  [P.Drivers.Manage]: 'إضافة السائقين وتعديلهم وإعادة تعيين كلمة المرور',
  [P.Assignments.Read]: 'عرض الإيجارات',
  [P.Assignments.Manage]: 'بدء الإيجارات وتعديل شروطها وإلغاؤها',
  [P.Inspections.Read]: 'عرض فحوصات الاستلام',
  [P.Inspections.Manage]: 'تسجيل فحص استلام الموتوسيكل',
  [P.Maintenance.Read]: 'عرض سجلات الصيانة',
  [P.Maintenance.Manage]: 'إدارة سجلات الصيانة وتقرير الفني',
  [P.Maintenance.Policies]: 'تعديل سياسة تغيير الزيت وسعر الغرامة',
  [P.Maintenance.OilReview]: 'مشاهدة فيديوهات تغيير الزيت وقبولها أو رفضها',
  [P.Maintenance.Verify]: 'اعتماد الإصلاح كمشرف',
  [P.Alerts.Read]: 'عرض تنبيهات الزيت',
  [P.Alerts.Manage]: 'تأكيد الاطلاع على تنبيهات الزيت',
  [P.Incidents.Read]: 'عرض حوادث التتبع والكهرباء',
  [P.Incidents.Manage]: 'تأكيد حوادث التتبع وحلها',
  [P.DriverLedger.Read]: 'عرض مديونيات السائقين وكشوف الحساب',
  [P.DriverPayments.Manage]: 'تسجيل الدفعات وإلغاؤها وإضافة مديونيات يدوية',
  [P.RepairInvoices.Decide]: 'تحديد من يتحمل فاتورة الإصلاح',
  [P.Documents.Read]: 'عرض المستندات وتنزيلها',
  [P.Documents.Manage]: 'رفع المستندات وحذفها',
  [P.Users.Read]: 'عرض المستخدمين',
  [P.Users.Manage]: 'إضافة المستخدمين وتعديلهم وإيقافهم',
  [P.Roles.Manage]: 'إدارة الأدوار والصلاحيات',
  [P.Offices.Read]: 'عرض المكاتب',
  [P.Offices.Manage]: 'إضافة المكاتب وتعديلها وحذفها',
  [P.Integrations.Read]: 'متابعة حالة التكاملات وسجلات المزامنة والإشعارات',
};

export const permissionGroupKey = (permission: string): string =>
  permission.includes('.') ? permission.slice(0, permission.indexOf('.')) : permission;

export const permissionLabel = (permission: string): string =>
  PERMISSION_LABELS[permission] ?? permission;

export const permissionGroupMeta = (key: string): PermissionGroupMeta =>
  PERMISSION_GROUPS[key] ?? { label: key, icon: 'grid' };
