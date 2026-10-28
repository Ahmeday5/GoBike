import { Injectable, signal } from '@angular/core';

/**
 * The current page's title (from the route's `title`), as a signal for the
 * topbar. Written by `AppTitleStrategy` on every navigation.
 */
@Injectable({ providedIn: 'root' })
export class PageTitleService {
  private readonly current = signal('');
  readonly title = this.current.asReadonly();

  set(title: string): void {
    this.current.set(title);
  }
}
