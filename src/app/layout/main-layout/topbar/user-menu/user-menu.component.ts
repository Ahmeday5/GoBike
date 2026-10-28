import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/services/auth.service';
import { DialogService } from '@core/services/dialog.service';
import { LayoutService } from '@core/services/layout.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { APP_ROUTES } from '@core/constants/app-routes';

/**
 * Avatar button + dropdown (profile summary, settings, sign out).
 * Closes on outside click, Escape, or picking an item.
 */
@Component({
  selector: 'app-user-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close()',
  },
})
export class UserMenuComponent {
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DialogService);
  private readonly layout = inject(LayoutService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly user = this.auth.currentUser;
  protected readonly open = signal(false);
  protected readonly accountLink = APP_ROUTES.account;

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  protected async logoutEverywhere(): Promise<void> {
    this.close();
    const confirmed = await this.dialog.confirm({
      title: 'الخروج من كل الأجهزة',
      message: 'سيتم إنهاء جلساتك على كل الأجهزة والمتصفحات، بما فيها هذا الجهاز.',
      type: 'warning',
      confirmText: 'خروج من الكل',
    });
    if (confirmed) this.auth.logoutAll();
  }

  protected async logout(): Promise<void> {
    this.close();
    const confirmed = await this.dialog.confirm({
      title: 'تسجيل الخروج',
      message: 'هل أنت متأكد أنك تريد تسجيل الخروج؟',
      type: 'warning',
      confirmText: 'تسجيل الخروج',
    });
    if (confirmed) {
      this.auth.logout();
      this.layout.closeMobile();
    }
  }
}
