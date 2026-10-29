import { Routes } from '@angular/router';

/** Mounted at `/repair-invoices` (app.routes gates the area). */
export const REPAIR_INVOICES_ROUTES: Routes = [
  {
    path: '',
    title: 'فواتير الإصلاح',
    loadComponent: () =>
      import('./pages/repair-invoices-list/repair-invoices-list.component').then(
        (m) => m.RepairInvoicesListComponent,
      ),
  },
  {
    path: ':id',
    title: 'فاتورة الإصلاح',
    loadComponent: () =>
      import('./pages/repair-invoice-detail/repair-invoice-detail.component').then(
        (m) => m.RepairInvoiceDetailComponent,
      ),
  },
];
