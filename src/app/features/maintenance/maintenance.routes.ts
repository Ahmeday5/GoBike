import { Routes } from '@angular/router';

/** Mounted at `/maintenance` (app.routes gates the area on `maintenance.read`). */
export const MAINTENANCE_ROUTES: Routes = [
  {
    path: '',
    title: 'الصيانة والإصلاح',
    loadComponent: () =>
      import('./pages/maintenance-page/maintenance-page.component').then(
        (m) => m.MaintenancePageComponent,
      ),
  },
  {
    path: ':id',
    title: 'سجل الصيانة',
    loadComponent: () =>
      import('./pages/maintenance-record/maintenance-record.component').then(
        (m) => m.MaintenanceRecordComponent,
      ),
  },
];
