import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '@core/services/theme.service';
import { LoaderComponent } from '@shared/components/loader/loader.component';
import { ToastComponent } from '@shared/components/toast/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, LoaderComponent, ToastComponent],
  template: `
    <app-loader />
    <app-toast />
    <router-outlet />
  `,
})
export class AppComponent {
  constructor() {
    // Eagerly start theme syncing (OS changes, <html data-theme>) on every page, auth pages included.
    inject(ThemeService);
  }
}
