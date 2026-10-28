import { Routes } from '@angular/router';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { permissionGuard } from '@core/auth/guards/permission.guard';

/** Mounted at `/motorcycles` (app.routes gates the area on `motorcycles.read`). */
export const MOTORCYCLES_ROUTES: Routes = [
  {
    path: '',
    title: 'الموتوسيكلات',
    loadComponent: () =>
      import('./pages/motorcycles-list/motorcycles-list.component').then(
        (m) => m.MotorcyclesListComponent,
      ),
  },
  {
    path: ':id/zone',
    title: 'نطاق الموتوسيكل',
    canActivate: [permissionGuard(PERMISSIONS.Motorcycles.Zone)],
    loadComponent: () =>
      import('./pages/motorcycle-zone/motorcycle-zone.component').then(
        (m) => m.MotorcycleZoneComponent,
      ),
  },
  {
    path: ':id',
    title: 'تفاصيل الموتوسيكل',
    loadComponent: () =>
      import('./pages/motorcycle-detail/motorcycle-detail.component').then(
        (m) => m.MotorcycleDetailComponent,
      ),
  },
];
