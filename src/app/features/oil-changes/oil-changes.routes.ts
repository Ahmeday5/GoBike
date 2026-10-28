import { Routes } from '@angular/router';

/** Mounted at `/oil-changes` (app.routes gates the area on `maintenance.oil_review`). */
export const OIL_CHANGES_ROUTES: Routes = [
  {
    path: '',
    title: 'فيديوهات تغيير الزيت',
    loadComponent: () =>
      import('./pages/oil-changes-queue/oil-changes-queue.component').then(
        (m) => m.OilChangesQueueComponent,
      ),
  },
  {
    path: ':id',
    title: 'مراجعة فيديو تغيير الزيت',
    loadComponent: () =>
      import('./pages/oil-change-review/oil-change-review.component').then(
        (m) => m.OilChangeReviewComponent,
      ),
  },
];
