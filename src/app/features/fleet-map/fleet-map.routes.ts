import { Routes } from '@angular/router';

/** Mounted at `/map` (app.routes gates the area on `gps.read`). */
export const FLEET_MAP_ROUTES: Routes = [
  {
    path: '',
    title: 'الخريطة المباشرة',
    loadComponent: () =>
      import('./pages/fleet-map/fleet-map.component').then((m) => m.FleetMapComponent),
  },
];
