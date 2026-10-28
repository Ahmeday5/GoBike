/**
 * Auth endpoint configuration — the only file you should need to touch to
 * point the GoBiky auth flow at a different backend.
 *
 * Every endpoint is relative to the runtime API URL (see `ApiService` / `AppConfigService`).
 */
export const AUTH_ENDPOINTS = {
  login: 'auth/login',
  logout: 'auth/logout',
  logoutAll: 'auth/logout-all',
  refresh: 'auth/refresh-token',
  /** Authoritative current-user + permissions endpoint, fetched after login. */
  me: 'auth/me',
} as const;

/** Default route to send an authenticated user to after login/guard redirects. */
export const DEFAULT_AUTHENTICATED_ROUTE = '/';

/** Login route — used by guards and the auth service to redirect unauthenticated users. */
export const LOGIN_ROUTE = '/auth/login';

/** Where role/permission guards send a signed-in user who lacks access. */
export const FORBIDDEN_ROUTE = '/forbidden';
