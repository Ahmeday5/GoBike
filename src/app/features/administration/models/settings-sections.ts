import { PERMISSIONS } from '@core/auth/constants/permissions';
import { APP_ROUTES } from '@core/constants/app-routes';

export interface SettingsSection {
  /** Child path under `/settings` (must match APP_ROUTES.settings). */
  path: string;
  url: string;
  label: string;
  icon: string;
  permission: string;
}

/** Settings sub-sections in display order; drives the pill nav and the default redirect. */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    path: 'offices',
    url: APP_ROUTES.settings.offices,
    label: 'المكاتب',
    icon: 'building',
    permission: PERMISSIONS.Offices.Read,
  },
  {
    path: 'users',
    url: APP_ROUTES.settings.users,
    label: 'المستخدمون',
    icon: 'users',
    permission: PERMISSIONS.Users.Read,
  },
  {
    path: 'roles',
    url: APP_ROUTES.settings.roles,
    label: 'الأدوار والصلاحيات',
    icon: 'shield',
    permission: PERMISSIONS.Roles.Manage,
  },
  {
    path: 'oil-policy',
    url: APP_ROUTES.settings.oilPolicy,
    label: 'سياسة تغيير الزيت',
    icon: 'droplet',
    permission: PERMISSIONS.Maintenance.Policies,
  },
  {
    path: 'gps-devices',
    url: APP_ROUTES.settings.gpsDevices,
    label: 'أجهزة التتبع',
    icon: 'map-pin',
    permission: PERMISSIONS.Gps.Manage,
  },
  {
    path: 'integrations',
    url: APP_ROUTES.settings.integrations,
    label: 'حالة التكاملات',
    icon: 'pulse',
    permission: PERMISSIONS.Integrations.Read,
  },
];
