import { Injectable } from '@angular/core';
import { environment } from '@env/environment';

/**
 * The one place app code reports problems. Today it writes to the console;
 * plug a monitoring SDK (Sentry, Application Insights, …) into `error()` and
 * every caller — including the global `ErrorHandler` — reports there too.
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  /* eslint-disable no-console */
  debug(message: string, ...data: unknown[]): void {
    if (!environment.production) console.debug(message, ...data);
  }

  warn(message: string, ...data: unknown[]): void {
    console.warn(message, ...data);
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    console.error(message, error, context ?? '');
    // e.g. Sentry.captureException(error, { extra: { message, ...context } });
  }
  /* eslint-enable no-console */
}
