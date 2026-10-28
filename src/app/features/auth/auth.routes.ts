import { Routes } from '@angular/router';

/** Mounted under `/auth` by `app.routes.ts` (inside the auth layout + guestGuard). */
export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    title: 'تسجيل الدخول',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
