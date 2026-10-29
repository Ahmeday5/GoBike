import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { SKIP_AUTH } from '@core/http/http-context.tokens';
import { AUTH_ENDPOINTS } from '../auth.config';
import { isJwtExpired } from '../utils/jwt.util';

/**
 * Attaches `Authorization: Bearer <token>` to every request unless the caller
 * opts out via `SKIP_AUTH`, and recovers from a 401 by delegating to
 * `AuthService.refreshToken()` — which is shared, so concurrent 401s only
 * trigger one round-trip.
 *
 * Proactive freshness: if the stored access token is already expired (or
 * within a short window of expiry), the interceptor refreshes BEFORE
 * sending. This eliminates the 401 → refresh → retry round-trip on startup
 * and avoids a storm of expired requests hitting the server simultaneously.
 *
 * Auth endpoints (login / refresh / logout) are excluded from both paths to
 * avoid recursion.
 */

/** Safety margin: treat a token expiring within this window as already expired. */
const EXPIRY_BUFFER_MS = 10_000;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_AUTH)) return next(req);

  const auth = inject(AuthService);
  const token = auth.getAccessToken();

  // Proactively refresh if the token is missing (it lives in memory, so a
  // reload starts without one), expired or about to expire.
  // `refreshToken()` is shared across concurrent callers so N startup
  // requests all hitting this path still produce only one network round-trip.
  if (token ? isJwtExpired(token, EXPIRY_BUFFER_MS) : auth.isLoggedIn()) {
    return auth.refreshToken().pipe(
      switchMap((tokens) => next(withAuthHeader(req, tokens.accessToken))),
      catchError((err) => throwError(() => err)),
    );
  }

  const authReq = token ? withAuthHeader(req, token) : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || isAuthEndpoint(req.url)) {
        return throwError(() => err);
      }
      // Backend contract: `Token-Expired: true` means "refresh and retry once".
      // Any other 401 is a dead session (revoked, user deactivated…) — retrying
      // would only fail again, so go straight to the login page.
      // The retry below calls `next` directly, so it can't loop.
      if (err.headers?.get(TOKEN_EXPIRED_HEADER) === 'true') {
        return retryAfterRefresh(req, next, auth);
      }
      auth.logout({ callApi: false, reason: 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى' });
      return throwError(() => err);
    }),
  );
};

/** Set by the backend on a 401 caused only by an expired access token. */
const TOKEN_EXPIRED_HEADER = 'Token-Expired';

function retryAfterRefresh(req: HttpRequest<unknown>, next: HttpHandlerFn, auth: AuthService) {
  return auth.refreshToken().pipe(
    switchMap((tokens) => next(withAuthHeader(req, tokens.accessToken))),
    catchError((refreshErr) =>
      // refreshToken() already cleared the session and redirected — just
      // surface the error so the original caller's stream completes.
      throwError(() => refreshErr),
    ),
  );
}

function withAuthHeader(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function isAuthEndpoint(url: string): boolean {
  return (
    url.includes(AUTH_ENDPOINTS.login) ||
    url.includes(AUTH_ENDPOINTS.refresh) ||
    url.includes(AUTH_ENDPOINTS.logout)
  );
}
