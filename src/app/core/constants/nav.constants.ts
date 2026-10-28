import { MenuSection } from '../models/menu-item.model';
import { PERMISSIONS as P } from '../auth/constants/permissions';
import { APP_ROUTES as R } from './app-routes';

/**
 * Sidebar navigation, built from permissions (`/auth/me`). Hiding is UX only —
 * every route has a matching guard and the backend enforces it anyway.
 *
 * `permissions` is an ANY-of gate; omit it to show an item to everyone.
 * Keep gates in sync with each feature's `*.routes.ts`.
 */
export const NAV_SECTIONS: MenuSection[] = [
  {
    label: 'المتابعة',
    items: [
      {
        id: 'map',
        label: 'الخريطة المباشرة',
        route: R.map,
        icon: 'map',
        permissions: [P.Gps.Read],
      },
      {
        id: 'alerts',
        label: 'مركز التنبيهات',
        route: R.alerts,
        icon: 'bell',
        permissions: [P.Alerts.Read, P.Incidents.Read],
      },
    ],
  },
  {
    label: 'الأسطول',
    items: [
      {
        id: 'motorcycles',
        label: 'الموتوسيكلات',
        route: R.motorcycles,
        icon: 'bike',
        permissions: [P.Motorcycles.Read],
      },
      {
        id: 'drivers',
        label: 'السائقون',
        route: R.drivers,
        icon: 'users',
        permissions: [P.Drivers.Read],
      },
      {
        id: 'rentals',
        label: 'الإيجارات',
        route: R.rentals,
        icon: 'route',
        permissions: [P.Assignments.Read],
      },
      {
        id: 'inspections',
        label: 'فحوصات الاستلام',
        route: R.inspections,
        icon: 'search',
        permissions: [P.Inspections.Read],
      },
    ],
  },
  {
    label: 'الصيانة',
    items: [
      {
        id: 'maintenance',
        label: 'الصيانة والإصلاحات',
        route: R.maintenance,
        icon: 'wrench',
        permissions: [P.Maintenance.Read],
      },
      {
        id: 'oil-changes',
        label: 'فيديوهات تغيير الزيت',
        route: R.oilChanges,
        icon: 'video',
        permissions: [P.Maintenance.OilReview],
      },
    ],
  },
  {
    label: 'المالية',
    items: [
      {
        id: 'repair-invoices',
        label: 'فواتير الإصلاح',
        route: R.repairInvoices,
        icon: 'file',
        permissions: [P.Maintenance.Read, P.RepairInvoices.Decide],
      },
      {
        id: 'documents',
        label: 'المستندات',
        route: R.documents,
        icon: 'archive',
        permissions: [P.Documents.Read],
      },
    ],
  },
  {
    label: 'الإدارة',
    items: [
      {
        id: 'oil-policy',
        label: 'سياسة تغيير الزيت',
        route: R.settings.oilPolicy,
        icon: 'droplet',
        permissions: [P.Maintenance.Policies],
      },
      {
        id: 'offices',
        label: 'المكاتب',
        route: R.settings.offices,
        icon: 'building',
        permissions: [P.Offices.Read],
      },
      {
        id: 'users',
        label: 'المستخدمون',
        route: R.settings.users,
        icon: 'user',
        permissions: [P.Users.Read],
      },
      {
        id: 'roles',
        label: 'الأدوار والصلاحيات',
        route: R.settings.roles,
        icon: 'shield',
        permissions: [P.Roles.Manage],
      },
      {
        id: 'gps-devices',
        label: 'أجهزة التتبع',
        route: R.settings.gpsDevices,
        icon: 'map-pin',
        permissions: [P.Gps.Manage],
      },
      {
        id: 'integrations',
        label: 'حالة التكاملات',
        route: R.settings.integrations,
        icon: 'pulse',
        permissions: [P.Integrations.Read],
      },
    ],
  },
];
