import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { PERMISSIONS as P } from '@core/auth/constants/permissions';
import { permissionGuard } from '@core/auth/guards/permission.guard';
import { AuthService } from '@core/auth/services/auth.service';
import { APP_ROUTES } from '@core/constants/app-routes';
import { SETTINGS_SECTIONS } from './models/settings-sections';

/**
 * `/settings` lands on Offices — or, for users who can't see offices, on the
 * first section they can open, so nobody bounces to "forbidden" from the menu.
 */
const firstAllowedSection = (): string => {
  const auth = inject(AuthService);
  return (
    SETTINGS_SECTIONS.find((s) => auth.hasPermission(s.permission))?.url ??
    APP_ROUTES.settings.offices
  );
};

/** Mounted at `/settings`. No area guard: each section is gated on its own permission. */
export const ADMINISTRATION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/settings-shell/settings-shell.component').then(
        (m) => m.SettingsShellComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: firstAllowedSection },
      {
        path: 'oil-policy',
        title: 'سياسة تغيير الزيت',
        canActivate: [permissionGuard(P.Maintenance.Policies)],
        loadComponent: () =>
          import('./pages/oil-policy/oil-policy.component').then((m) => m.OilPolicyComponent),
      },
      {
        path: 'offices',
        title: 'المكاتب',
        canActivate: [permissionGuard(P.Offices.Read)],
        loadComponent: () =>
          import('./pages/offices/offices.component').then((m) => m.OfficesComponent),
      },
      {
        path: 'users',
        title: 'المستخدمون',
        canActivate: [permissionGuard(P.Users.Read)],
        loadComponent: () => import('./pages/users/users.component').then((m) => m.UsersComponent),
      },
      {
        path: 'roles',
        title: 'الأدوار والصلاحيات',
        canActivate: [permissionGuard(P.Roles.Manage)],
        loadComponent: () => import('./pages/roles/roles.component').then((m) => m.RolesComponent),
      },
      {
        path: 'gps-devices',
        title: 'أجهزة التتبع',
        canActivate: [permissionGuard(P.Gps.Manage)],
        loadComponent: () =>
          import('./pages/gps-devices/gps-devices.component').then((m) => m.GpsDevicesComponent),
      },
      {
        path: 'integrations',
        title: 'حالة التكاملات',
        canActivate: [permissionGuard(P.Integrations.Read)],
        loadComponent: () =>
          import('./pages/integrations/integrations.component').then(
            (m) => m.IntegrationsComponent,
          ),
      },
    ],
  },
];
