import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SettingsNavComponent } from '../../components/settings-nav/settings-nav.component';

/** Frame for every settings section: the pill nav on top, the section below. */
@Component({
  selector: 'app-settings-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SettingsNavComponent],
  template: `
    <app-settings-nav />
    <router-outlet />
  `,
})
export class SettingsShellComponent {}
