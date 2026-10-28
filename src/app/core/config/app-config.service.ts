import { APP_INITIALIZER, Injectable, Provider, inject } from '@angular/core';
import { environment } from '@env/environment';

/** Settings that may differ per deployment without rebuilding the bundle. */
export interface AppConfig {
  apiUrl: string;
  hubUrl: string;
}

const CONFIG_URL = 'config.json';

/**
 * Runtime configuration: build once, deploy to any environment.
 *
 * Defaults come from `environment.ts`; at startup `config.json` (served from
 * `public/`) is fetched and any keys it defines win. A missing or broken
 * file is not fatal — the app simply runs on the build-time defaults.
 *
 * `fetch` is used instead of `HttpClient` on purpose: the config must load
 * before interceptors (auth, loader, error toasts) are allowed to run.
 */
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private config: AppConfig = { apiUrl: environment.apiUrl, hubUrl: environment.hubUrl };

  get apiUrl(): string {
    return this.config.apiUrl;
  }

  get hubUrl(): string {
    return this.config.hubUrl;
  }

  async load(): Promise<void> {
    try {
      const res = await fetch(CONFIG_URL, { cache: 'no-store' });
      if (!res.ok) return;
      const overrides = (await res.json()) as Partial<AppConfig>;
      this.config = { ...this.config, ...stripEmpty(overrides) };
    } catch {
      /* no config.json → keep build-time defaults */
    }
  }
}

function stripEmpty(input: Partial<AppConfig>): Partial<AppConfig> {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  ) as Partial<AppConfig>;
}

export function provideAppConfig(): Provider {
  return {
    provide: APP_INITIALIZER,
    multi: true,
    useFactory: () => {
      const config = inject(AppConfigService);
      return () => config.load();
    },
  };
}
