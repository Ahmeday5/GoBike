import { Routes } from '@angular/router';

/** Mounted at `/notifications` (every signed-in user has an inbox). */
export const NOTIFICATIONS_ROUTES: Routes = [
  {
    path: '',
    title: 'الإشعارات',
    loadComponent: () =>
      import('./pages/notifications-page/notifications-page.component').then(
        (m) => m.NotificationsPageComponent,
      ),
  },
];
