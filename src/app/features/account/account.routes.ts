import { Routes } from '@angular/router';

export const ACCOUNT_ROUTES: Routes = [
  {
    path: '',
    title: 'حسابي',
    loadComponent: () =>
      import('./pages/account/account.component').then((m) => m.AccountComponent),
  },
];
