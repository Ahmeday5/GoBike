import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { permissionGuard } from '@core/auth/guards/permission.guard';
import { AuthService } from '@core/auth/services/auth.service';
import { APP_ROUTES } from '@core/constants/app-routes';
import { ToastService } from '@core/services/toast.service';
import { DriverLedgerApi } from './data-access/driver-ledger.api';

/**
 * `APP_ROUTES.driverCharge(id)` (notification deep link) → the charge's driver,
 * account tab. A charge has no page of its own, so this route never renders:
 * it resolves the driver and redirects.
 */
const driverChargeRedirect: CanActivateFn = (route) => {
  const router = inject(Router);
  const toast = inject(ToastService);
  const auth = inject(AuthService);
  const fallback = () =>
    router.parseUrl(
      auth.hasPermission(PERMISSIONS.Drivers.Read) ? APP_ROUTES.drivers : APP_ROUTES.notifications,
    );

  return inject(DriverLedgerApi)
    .charge(route.paramMap.get('id') ?? '')
    .pipe(
      map((charge) =>
        charge?.driverId
          ? router.createUrlTree([APP_ROUTES.driver(charge.driverId)], {
              queryParams: { tab: 'account' },
            })
          : fallback(),
      ),
      catchError(() => {
        toast.error('تعذّر فتح المديونية — ربما أُلغيت أو تتبع مكتبًا آخر');
        return of(fallback());
      }),
    );
};

/**
 * Mounted at `/drivers` (app.routes admits `drivers.read` OR `driver_ledger.read`).
 * The list needs `drivers.read`; the driver page also serves ledger-only users
 * (it shows them just the account tab).
 */
export const DRIVERS_ROUTES: Routes = [
  {
    path: '',
    title: 'السائقون',
    canActivate: [permissionGuard(PERMISSIONS.Drivers.Read)],
    loadComponent: () =>
      import('./pages/drivers-list/drivers-list.component').then((m) => m.DriversListComponent),
  },
  {
    path: 'charges/:id',
    canActivate: [driverChargeRedirect],
    // Never rendered — the guard always redirects.
    children: [],
  },
  {
    path: ':id',
    title: 'ملف السائق',
    loadComponent: () =>
      import('./pages/driver-detail/driver-detail.component').then((m) => m.DriverDetailComponent),
  },
];
