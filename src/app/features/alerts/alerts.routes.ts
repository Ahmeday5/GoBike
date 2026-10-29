import { Routes } from '@angular/router';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { permissionGuard } from '@core/auth/guards/permission.guard';

/** Mounted at `/alerts` (app.routes gates the area on `alerts.read` OR `incidents.read`). */
export const ALERTS_ROUTES: Routes = [
  {
    path: '',
    title: 'مركز التنبيهات',
    loadComponent: () =>
      import('./pages/alerts-center/alerts-center.component').then((m) => m.AlertsCenterComponent),
  },
  {
    path: 'incidents/:id',
    title: 'تفاصيل الحادثة',
    canActivate: [permissionGuard(PERMISSIONS.Incidents.Read)],
    loadComponent: () =>
      import('./pages/incident-detail/incident-detail.component').then(
        (m) => m.IncidentDetailComponent,
      ),
  },
];
