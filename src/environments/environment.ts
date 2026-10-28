/**
 * Build-time defaults. Anything deploy-specific (API URL, …) can be overridden
 * at runtime through `config.json` — see `core/config/app-config.service.ts`.
 */
export const environment = {
  production: false,
  appName: 'GoBiky',
  appVersion: '1.0.0',

  /** Relative so the dev server proxies it (see `proxy.conf.json`) — no CORS in dev. */
  apiUrl: '/api/v1',
  /** SignalR hub for live fleet updates and notifications. */
  hubUrl: '/hubs/dashboard',
  /** All dates are displayed in the company's timezone, whatever the viewer's clock says. */
  timeZone: 'Africa/Cairo',
  tokenKey: 'gobike_access_token',
  refreshTokenKey: 'gobike_refresh_token',
};
