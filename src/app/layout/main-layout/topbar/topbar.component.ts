import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LayoutService } from '@core/services/layout.service';
import { PageTitleService } from '@core/routing/page-title.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ThemeToggleComponent } from '@shared/components/theme-toggle/theme-toggle.component';
import { environment } from '@env/environment';
import { UserMenuComponent } from './user-menu/user-menu.component';
import { NotificationBellComponent } from './notification-bell/notification-bell.component';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';

const TODAY_FORMAT = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

@Component({
  selector: 'app-topbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, ThemeToggleComponent, UserMenuComponent, NotificationBellComponent],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  protected readonly layout = inject(LayoutService);
  private readonly pageTitle = inject(PageTitleService);
  protected readonly hubStatus = inject(DashboardHubService).status;

  protected readonly appName = environment.appName;
  protected readonly today = TODAY_FORMAT.format(new Date());

  /** Wrapped in an array so `@for … track` re-creates the node and replays the title animation. */
  protected readonly titleKey = computed(() => [this.pageTitle.title()]);

  protected readonly toggleLabel = computed(() => {
    if (this.layout.isMobile()) return this.layout.mobileOpen() ? 'إغلاق القائمة' : 'فتح القائمة';
    return this.layout.collapsed() ? 'توسيع القائمة' : 'طي القائمة';
  });
}
