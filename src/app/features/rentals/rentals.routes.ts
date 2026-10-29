import { Routes } from '@angular/router';

/** Mounted at `/rentals` (app.routes gates the area on `assignments.read`). */
export const RENTALS_ROUTES: Routes = [
  {
    path: '',
    title: 'الإيجارات',
    loadComponent: () =>
      import('./pages/rentals-list/rentals-list.component').then((m) => m.RentalsListComponent),
  },
  {
    path: ':id',
    title: 'تفاصيل الإيجار',
    loadComponent: () =>
      import('./pages/rental-detail/rental-detail.component').then((m) => m.RentalDetailComponent),
  },
];

/** Mounted at `/inspections` (app.routes gates the area on `inspections.read`). */
export const INSPECTIONS_ROUTES: Routes = [
  {
    path: '',
    title: 'فحوصات الاستلام',
    loadComponent: () =>
      import('./pages/inspections-list/inspections-list.component').then(
        (m) => m.InspectionsListComponent,
      ),
  },
  {
    path: ':id',
    title: 'تقرير فحص الاستلام',
    loadComponent: () =>
      import('./pages/inspection-detail/inspection-detail.component').then(
        (m) => m.InspectionDetailComponent,
      ),
  },
];
