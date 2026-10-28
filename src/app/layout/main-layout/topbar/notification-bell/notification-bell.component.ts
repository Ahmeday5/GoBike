import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NotificationCenterService } from '@core/notifications/notification-center.service';
import { AppNotification } from '@core/realtime/realtime.models';
import { NOTIFICATION_SEVERITY, enumMeta } from '@core/constants/enums';
import { APP_ROUTES } from '@core/constants/app-routes';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CairoDatePipe } from '@shared/pipes/format.pipes';

/** Bell + badge + dropdown of the latest notifications. */
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, CairoDatePipe],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
})
export class NotificationBellComponent {
  protected readonly center = inject(NotificationCenterService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly open = signal(false);
  protected readonly ringing = signal(false);
  protected readonly allLink = APP_ROUTES.notifications;
  protected readonly badge = computed(() => {
    const n = this.center.unreadCount();
    return n > 99 ? '99+' : n ? String(n) : '';
  });

  constructor() {
    // Ring the bell briefly whenever the count goes up.
    let previous = 0;
    effect(() => {
      const count = this.center.unreadCount();
      if (count > previous) untracked(() => this.ring());
      previous = count;
    });
  }

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  protected select(n: AppNotification): void {
    this.open.set(false);
    this.center.open(n);
  }

  protected markAll(): void {
    this.center.markAllRead().subscribe({ error: () => undefined });
  }

  protected severity(n: AppNotification) {
    return enumMeta(NOTIFICATION_SEVERITY, n.severity);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node))
      this.open.set(false);
  }

  private ring(): void {
    this.ringing.set(true);
    setTimeout(() => this.ringing.set(false), 900);
  }
}
