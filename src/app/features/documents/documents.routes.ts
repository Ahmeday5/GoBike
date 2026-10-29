import { Routes } from '@angular/router';

/** Mounted at `/documents` (app.routes gates the area on `documents.read`). */
export const DOCUMENTS_ROUTES: Routes = [
  {
    path: '',
    title: 'المستندات',
    loadComponent: () =>
      import('./pages/documents-page/documents-page.component').then(
        (m) => m.DocumentsPageComponent,
      ),
  },
];
