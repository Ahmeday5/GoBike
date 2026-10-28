import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '@core/auth/services/auth.service';
import { ThemePreference, ThemeService } from '@core/services/theme.service';
import { environment } from '@env/environment';

@Component({
  selector: 'app-account',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account.component.html',
})
export class AccountComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly user = inject(AuthService).currentUser;
  protected readonly appVersion = environment.appVersion;

  protected readonly themeOptions: ReadonlyArray<{ value: ThemePreference; label: string }> = [
    { value: 'light', label: 'فاتح' },
    { value: 'dark', label: 'داكن' },
    { value: 'system', label: 'حسب إعدادات الجهاز' },
  ];
}
