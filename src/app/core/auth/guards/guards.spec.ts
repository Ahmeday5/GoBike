import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';
import { guestGuard } from './guest.guard';
import { permissionGuard } from './permission.guard';
import { roleGuard } from './role.guard';
import { accessGuard } from './access.guard';

interface FakeAuth {
  loggedIn: boolean;
  role: string;
  permissions: string[];
}

function setup(state: Partial<FakeAuth> = {}) {
  const s: FakeAuth = { loggedIn: true, role: 'Staff', permissions: [], ...state };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          isLoggedIn: () => s.loggedIn,
          hasAnyRole: (roles: readonly string[]) => roles.includes(s.role),
          hasPermission: (p: readonly string[]) => p.every((x) => s.permissions.includes(x)),
          hasAnyPermission: (p: readonly string[]) => p.some((x) => s.permissions.includes(x)),
        },
      },
    ],
  });
}

function run(guard: CanActivateFn, url = '/users'): boolean | UrlTree {
  return TestBed.runInInjectionContext(
    () => guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot) as boolean | UrlTree,
  );
}

const path = (result: boolean | UrlTree) =>
  result instanceof UrlTree ? result.toString() : result;

describe('route guards', () => {
  describe('authGuard', () => {
    it('lets signed-in users through', () => {
      setup();
      expect(run(authGuard)).toBe(true);
    });

    it('redirects to login and keeps the return URL', () => {
      setup({ loggedIn: false });
      expect(path(run(authGuard, '/users?page=2'))).toBe(
        '/auth/login?returnUrl=%2Fusers%3Fpage%3D2',
      );
    });
  });

  describe('guestGuard', () => {
    it('sends signed-in users to the home route', () => {
      setup();
      expect(path(run(guestGuard))).toBe('/');
    });

    it('lets guests see auth pages', () => {
      setup({ loggedIn: false });
      expect(run(guestGuard)).toBe(true);
    });
  });

  describe('permissionGuard', () => {
    it('requires ALL permissions by default', () => {
      setup({ permissions: ['A'] });
      expect(path(run(permissionGuard(['A', 'B'])))).toBe('/forbidden');
      expect(run(permissionGuard('A'))).toBe(true);
    });

    it('supports ANY mode', () => {
      setup({ permissions: ['B'] });
      expect(run(permissionGuard(['A', 'B'], { mode: 'any' }))).toBe(true);
    });

    it('redirects anonymous users to login, not 403', () => {
      setup({ loggedIn: false });
      expect(path(run(permissionGuard('A')))).toBe('/auth/login');
    });
  });

  describe('roleGuard', () => {
    it('allows listed roles and forbids others', () => {
      setup({ role: 'Admin' });
      expect(run(roleGuard(['Admin']))).toBe(true);
      expect(path(run(roleGuard(['Manager'])))).toBe('/forbidden');
    });
  });

  describe('accessGuard', () => {
    it('grants on permission OR role', () => {
      setup({ role: 'Admin', permissions: [] });
      expect(run(accessGuard({ anyPermission: ['X'], anyRole: ['Admin'] }))).toBe(true);
    });

    it('honors a custom fallback', () => {
      setup();
      expect(path(run(accessGuard({ anyPermission: ['X'], fallback: '/nope' })))).toBe('/nope');
    });
  });
});
