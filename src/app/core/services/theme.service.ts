import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** Keep in sync with the inline boot script in `index.html`. */
const THEME_KEY = 'gobike_theme';

/**
 * Light/dark theme with a "follow the OS" option. The resolved theme is
 * written to `<html data-theme>`; `styles.scss` swaps the design tokens on
 * that attribute, so components never need to know the theme.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(StorageService);
  private readonly media = this.document.defaultView?.matchMedia('(prefers-color-scheme: dark)');

  private readonly systemDark = signal(this.media?.matches ?? false);
  readonly preference = signal<ThemePreference>(this.loadPreference());
  readonly theme = computed<ResolvedTheme>(() => {
    const pref = this.preference();
    if (pref === 'system') return this.systemDark() ? 'dark' : 'light';
    return pref;
  });

  constructor() {
    const onChange = (e: MediaQueryListEvent) => this.systemDark.set(e.matches);
    this.media?.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => this.media?.removeEventListener('change', onChange));

    effect(() => {
      const root = this.document.documentElement;
      root.dataset['theme'] = this.theme();
      root.dataset['bsTheme'] = this.theme(); // Bootstrap's own dark mode
      root.style.colorScheme = this.theme();
    });
  }

  setPreference(pref: ThemePreference): void {
    this.preference.set(pref);
    this.storage.set(THEME_KEY, pref);
  }

  /** Flip between light and dark (leaves "system" mode). */
  toggle(): void {
    this.setPreference(this.theme() === 'dark' ? 'light' : 'dark');
  }

  private loadPreference(): ThemePreference {
    const stored = this.storage.get(THEME_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  }
}
