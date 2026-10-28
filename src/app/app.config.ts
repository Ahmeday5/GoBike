import { registerLocaleData } from '@angular/common';
import localeAr from '@angular/common/locales/ar';
import {
  ApplicationConfig,
  ErrorHandler,
  LOCALE_ID,
  provideZoneChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withViewTransitions,
  withComponentInputBinding,
  withRouterConfig,
  withPreloading,
  withInMemoryScrolling,
  PreloadAllModules,
  TitleStrategy,
} from '@angular/router';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { authInterceptor } from '@core/auth/interceptors/auth.interceptor';
import { cacheInterceptor } from '@core/interceptors/cache.interceptor';
import { errorInterceptor } from '@core/interceptors/error.interceptor';
import { loaderInterceptor } from '@core/interceptors/loader.interceptor';
import { timeoutInterceptor } from '@core/interceptors/timeout.interceptor';
import { provideAppConfig } from '@core/config/app-config.service';
import { GlobalErrorHandler } from '@core/errors/global-error-handler';
import { AppTitleStrategy } from '@core/routing/app-title.strategy';

// Arabic-only app: dates, numbers and currency pipes format for 'ar'.
registerLocaleData(localeAr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    { provide: LOCALE_ID, useValue: 'ar' },
    provideAppConfig(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideRouter(
      routes,
      withViewTransitions(),
      withComponentInputBinding(),
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      withPreloading(PreloadAllModules),
    ),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    // Interceptor order matters (outermost → innermost → HTTP backend):
    //   cache   → short-circuits hits before any other work runs
    //   timeout → bounds how long a request may hang with no response at all
    //             (must wrap loader/error so a stall still hides the loader
    //             and reaches the error layer instead of spinning forever)
    //   loader  → toggles the global spinner
    //   error   → normalizes failures into ApiError + toasts
    //   auth    → attaches Bearer + handles 401 refresh dance (must be
    //             innermost so it intercepts 401s BEFORE error can toast them;
    //             successful retries never reach the error layer at all)
    provideHttpClient(
      withFetch(),
      withInterceptors([
        cacheInterceptor,
        timeoutInterceptor,
        loaderInterceptor,
        errorInterceptor,
        authInterceptor,
      ]),
    ),
    provideAnimationsAsync(),
  ],
};
