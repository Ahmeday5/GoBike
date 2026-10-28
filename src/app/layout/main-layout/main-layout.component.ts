import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '@core/auth/services/auth.service';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { NotificationCenterService } from '@core/notifications/notification-center.service';
import { RouterOutlet } from '@angular/router';
import { TopbarComponent } from './topbar/topbar.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { LayoutService } from '@core/services/layout.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, TopbarComponent, SidebarComponent, ConfirmDialogComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  host: {
    // Keyboard equivalent of tapping the mobile drawer's backdrop.
    '(document:keydown.escape)': 'layout.closeMobile()',
  },
})
export class MainLayoutComponent {
  protected readonly layout = inject(LayoutService);

  constructor() {
    // The shell owns the live connection + notification badge for the session.
    inject(DashboardHubService);
    inject(NotificationCenterService);
    // Pick up role/permission/office changes made by an admin since the last visit.
    inject(AuthService)
      .refreshProfile()
      .subscribe({ error: () => undefined });
  }
}
