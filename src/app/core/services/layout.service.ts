import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';

/** Keep in sync with the sidebar's mobile breakpoint in SCSS. */
const MOBILE_QUERY = '(max-width: 991.98px)';
const COLLAPSED_KEY = 'gobike_sidebar_collapsed';

/**
 * Main-layout UI state: desktop sidebar collapse (remembered across visits)
 * and the mobile drawer. `toggleSidebar()` does the right thing for the
 * current viewport, so the topbar needs a single button.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly storage = inject(StorageService);
  private readonly media = inject(DOCUMENT).defaultView?.matchMedia(MOBILE_QUERY);

  readonly collapsed = signal(this.storage.get(COLLAPSED_KEY) === '1');
  readonly mobileOpen = signal(false);
  readonly isMobile = signal(this.media?.matches ?? false);

  constructor() {
    const onChange = (e: MediaQueryListEvent) => {
      this.isMobile.set(e.matches);
      if (!e.matches) this.mobileOpen.set(false);
    };
    this.media?.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => this.media?.removeEventListener('change', onChange));

    effect(() => this.storage.set(COLLAPSED_KEY, this.collapsed() ? '1' : '0'));
  }

  toggleSidebar(): void {
    if (this.isMobile()) this.toggleMobile();
    else this.toggleCollapsed();
  }

  toggleCollapsed(): void {
    this.collapsed.update((v) => !v);
  }
  openMobile(): void {
    this.mobileOpen.set(true);
  }
  closeMobile(): void {
    this.mobileOpen.set(false);
  }
  toggleMobile(): void {
    this.mobileOpen.update((v) => !v);
  }
}
