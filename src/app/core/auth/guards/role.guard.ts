import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/auth.model';
import { FORBIDDEN_ROUTE, LOGIN_ROUTE } from '../auth.config';

/**
 * Restricts a route to specific roles.
 *
 *   { path: 'settings', canActivate: [roleGuard([ROLES.Admin])], ... }
 */
export const roleGuard =
  (allowed: ReadonlyArray<UserRole>): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isLoggedIn()) {
      return router.createUrlTree([LOGIN_ROUTE]);
    }
    if (auth.hasAnyRole(allowed)) return true;

    return router.createUrlTree([FORBIDDEN_ROUTE]);
  };

/**
 * Inverse of {@link roleGuard} — denies the listed roles and lets everyone
 * else through. Use it to carve a role out of a route it would otherwise
 * reach via permissions.
 *
 *   { path: 'admin-only', canActivate: [denyRolesGuard(['Guest'])] }
 */
export const denyRolesGuard =
  (blocked: ReadonlyArray<UserRole>): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isLoggedIn()) {
      return router.createUrlTree([LOGIN_ROUTE]);
    }
    if (auth.hasAnyRole(blocked)) {
      return router.createUrlTree([FORBIDDEN_ROUTE]);
    }
    return true;
  };
