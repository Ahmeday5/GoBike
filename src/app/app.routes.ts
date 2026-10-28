import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/guards/auth.guard';
import { guestGuard } from '@core/auth/guards/guest.guard';
import { accessGuard } from '@core/auth/guards/access.guard';
import { homeRedirectGuard } from '@core/auth/guards/home-redirect.guard';
import { PERMISSIONS as P } from '@core/auth/constants/permissions';

/** Feature-level gate: the user needs ANY of these permissions to enter the area. */
const requires = (...permissions: string[]) => [accessGuard({ anyPermission: permissions })];

/**
 * Top-level routing only: layouts, one lazy `loadChildren` per feature and
 * the coarse permission gate for each area. Finer gates (e.g. the zone
 * editor) live in the feature's own `*.routes.ts`.
 */
export const routes: Routes = [
  // Auth area — only reachable when NOT signed in
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('@layout/auth-layout/auth-layout.component').then((m) => m.AuthLayoutComponent),
    loadChildren: () => import('@features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },

  // Authenticated app shell
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () =>
      import('@layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', canActivate: [homeRedirectGuard], children: [] },
      {
        path: 'map',
        canActivate: requires(P.Gps.Read),
        loadChildren: () =>
          import('@features/fleet-map/fleet-map.routes').then((m) => m.FLEET_MAP_ROUTES),
      },
      {
        path: 'motorcycles',
        canActivate: requires(P.Motorcycles.Read),
        loadChildren: () =>
          import('@features/motorcycles/motorcycles.routes').then((m) => m.MOTORCYCLES_ROUTES),
      },
      {
        path: 'drivers',
        canActivate: requires(P.Drivers.Read, P.DriverLedger.Read),
        loadChildren: () =>
          import('@features/drivers/drivers.routes').then((m) => m.DRIVERS_ROUTES),
      },
      {
        path: 'rentals',
        canActivate: requires(P.Assignments.Read),
        loadChildren: () =>
          import('@features/rentals/rentals.routes').then((m) => m.RENTALS_ROUTES),
      },
      {
        path: 'inspections',
        canActivate: requires(P.Inspections.Read),
        loadChildren: () =>
          import('@features/rentals/rentals.routes').then((m) => m.INSPECTIONS_ROUTES),
      },
      {
        path: 'maintenance',
        canActivate: requires(P.Maintenance.Read),
        loadChildren: () =>
          import('@features/maintenance/maintenance.routes').then((m) => m.MAINTENANCE_ROUTES),
      },
      {
        path: 'oil-changes',
        canActivate: requires(P.Maintenance.OilReview),
        loadChildren: () =>
          import('@features/oil-changes/oil-changes.routes').then((m) => m.OIL_CHANGES_ROUTES),
      },
      {
        path: 'alerts',
        canActivate: requires(P.Alerts.Read, P.Incidents.Read),
        loadChildren: () => import('@features/alerts/alerts.routes').then((m) => m.ALERTS_ROUTES),
      },
      {
        path: 'repair-invoices',
        canActivate: requires(P.Maintenance.Read, P.RepairInvoices.Decide),
        loadChildren: () =>
          import('@features/repair-invoices/repair-invoices.routes').then(
            (m) => m.REPAIR_INVOICES_ROUTES,
          ),
      },
      {
        path: 'documents',
        canActivate: requires(P.Documents.Read),
        loadChildren: () =>
          import('@features/documents/documents.routes').then((m) => m.DOCUMENTS_ROUTES),
      },
      {
        path: 'notifications',
        loadChildren: () =>
          import('@features/notifications/notifications.routes').then(
            (m) => m.NOTIFICATIONS_ROUTES,
          ),
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('@features/administration/administration.routes').then(
            (m) => m.ADMINISTRATION_ROUTES,
          ),
      },
      {
        path: 'account',
        loadChildren: () =>
          import('@features/account/account.routes').then((m) => m.ACCOUNT_ROUTES),
      },
      {
        path: 'forbidden',
        title: 'غير مصرح بالوصول',
        loadComponent: () =>
          import('@features/errors/pages/forbidden/forbidden.component').then(
            (m) => m.ForbiddenComponent,
          ),
      },
    ],
  },

  {
    path: '**',
    title: 'الصفحة غير موجودة',
    loadComponent: () =>
      import('@features/errors/pages/not-found/not-found.component').then(
        (m) => m.NotFoundComponent,
      ),
  },
];
