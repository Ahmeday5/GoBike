import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { environment } from '@env/environment';
import { PageTitleService } from './page-title.service';

/**
 * Turns each route's `title` into "<Page> | GoBiky" for the browser tab and
 * publishes the bare page title to `PageTitleService` for the topbar.
 */
@Injectable()
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly pageTitle = inject(PageTitleService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot) ?? '';
    this.pageTitle.set(page);
    this.title.setTitle(page ? `${page} | ${environment.appName}` : environment.appName);
  }
}
