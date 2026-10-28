/**
 * Swapped in for `environment.ts` by the production build (`fileReplacements`
 * in angular.json). Points at the production backend; a deployment can still
 * override both URLs through `config.json` (or `API_URL`/`HUB_URL` in Docker).
 */
export const environment = {
  production: true,
  appName: 'GoBiky',
  appVersion: '1.0.0',

  apiUrl: 'https://gobike.runasp.net/api/v1',
  /** SignalR hub for live fleet updates and notifications. */
  hubUrl: 'https://gobike.runasp.net/hubs/dashboard',
  /** All dates are displayed in the company's timezone, whatever the viewer's clock says. */
  timeZone: 'Africa/Cairo',
  tokenKey: 'gobike_access_token',
  refreshTokenKey: 'gobike_refresh_token',
};
