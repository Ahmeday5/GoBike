import { ErrorHandler, Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { LoggerService } from '../services/logger.service';
import { ToastService } from '../services/toast.service';

/** Guards against a reload loop if the fresh bundle is also unreachable. */
const CHUNK_RELOAD_KEY = 'gobike_chunk_reload_at';
const CHUNK_RELOAD_COOLDOWN_MS = 10_000;

/**
 * Catches everything Angular doesn't: template errors, thrown exceptions in
 * effects/handlers, rejected promises. HTTP failures are already normalized
 * and toasted by `errorInterceptor`, so they're only logged here.
 *
 * Special case: after a new deploy, users on the old bundle request lazy
 * chunks whose hashed filenames no longer exist. That surfaces as a
 * "Failed to fetch dynamically imported module" error — the fix is a reload.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly logger = inject(LoggerService);
  private readonly toast = inject(ToastService);

  handleError(error: unknown): void {
    const err = unwrap(error);

    if (isChunkLoadError(err) && this.tryReload()) return;

    this.logger.error('[Unhandled]', err);

    if (!(err instanceof HttpErrorResponse)) {
      this.toast.error('حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.');
    }
  }

  private tryReload(): boolean {
    try {
      const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
      if (Date.now() - last < CHUNK_RELOAD_COOLDOWN_MS) return false;
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    } catch {
      /* storage disabled — reload anyway, once */
    }
    location.reload();
    return true;
  }
}

/** Zone/promise wrappers hide the real error under `.rejection`. */
function unwrap(error: unknown): unknown {
  const rejection = (error as { rejection?: unknown } | null)?.rejection;
  return rejection ?? error;
}

function isChunkLoadError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '');
  return /Failed to fetch dynamically imported module|Loading chunk [\w-]+ failed|Importing a module script failed/i.test(
    message,
  );
}
