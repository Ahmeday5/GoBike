import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { FORBIDDEN_ROUTE, LOGIN_ROUTE } from '../auth.config';

type PermissionRequirement = string | ReadonlyArray<string>;

interface PermissionGuardOptions {
  /** "all" → user must hold every permission; "any" → at least one. Default: "all". */
  mode?: 'all' | 'any';
  /** Where to redirect on denial. Default: `FORBIDDEN_ROUTE`. */
  fallback?: string;
}

/**
 * Restricts a route to users who hold the specified permission(s).
 *
 *   { path: 'users', canActivate: [permissionGuard(PERMISSIONS.Users.View)] }
 *   { path: 'reports', canActivate: [permissionGuard(
 *       [PERMISSIONS.Reports.View, PERMISSIONS.Reports.FullAccess], { mode: 'any' }
 *     )] }
 *
 * Pair with `authGuard` higher in the route tree — this guard assumes the
 * user is already authenticated, and only fails open with a redirect to
 * the login route when that turns out to be false.
 */
export const permissionGuard =
  (required: PermissionRequirement, options: PermissionGuardOptions = {}): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isLoggedIn()) {
      return router.createUrlTree([LOGIN_ROUTE]);
    }

    const list = (Array.isArray(required) ? required : [required as string]) as readonly string[];

    const granted = options.mode === 'any' ? auth.hasAnyPermission(list) : auth.hasPermission(list);

    if (granted) return true;

    return router.createUrlTree([options.fallback ?? FORBIDDEN_ROUTE]);
  };
