import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '@core/auth/services/auth.service';
import { STAFF_ROLE } from '@core/constants/enums';
import { LookupService } from '@core/data/lookup.service';
import { ThemePreference, ThemeService } from '@core/services/theme.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ChipComponent, EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { NumberPipe } from '@shared/pipes/format.pipes';
import { environment } from '@env/environment';

interface PermissionArea {
  key: string;
  permissions: string[];
}

/** The signed-in user's profile (from `/auth/me`) and display preferences. */
@Component({
  selector: 'app-account',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, ChipComponent, EnumChipComponent, IconComponent, NumberPipe],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
})
export class AccountComponent {
  private readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly user = this.auth.currentUser;
  protected readonly appVersion = environment.appVersion;
  protected readonly ROLE = STAFF_ROLE;

  private readonly offices = toSignal(inject(LookupService).offices(), { initialValue: [] });

  protected readonly initial = computed(() => (this.user()?.name ?? '?').trim().charAt(0) || '?');

  protected readonly officeName = computed(() => {
    const u = this.user();
    if (!u?.officeId) return null;
    return this.offices().find((o) => o.id === u.officeId)?.name ?? null;
  });

  /** Permissions grouped by area prefix (`motorcycles.read` → `motorcycles`). */
  protected readonly areas = computed<PermissionArea[]>(() => {
    const map = new Map<string, string[]>();
    for (const p of [...(this.user()?.permissions ?? [])].sort()) {
      const key = p.includes('.') ? p.slice(0, p.indexOf('.')) : p;
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()].map(([key, permissions]) => ({ key, permissions }));
  });

  protected readonly themeOptions: ReadonlyArray<{
    value: ThemePreference;
    label: string;
    icon: string;
  }> = [
    { value: 'light', label: 'فاتح', icon: 'sun' },
    { value: 'dark', label: 'داكن', icon: 'moon' },
    { value: 'system', label: 'حسب إعدادات الجهاز', icon: 'settings' },
  ];
}
