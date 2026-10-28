import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '@env/environment';
import { IconComponent, IconName } from '@shared/components/icon/icon.component';
import { LogoComponent } from '@shared/components/logo/logo.component';
import { ThemeToggleComponent } from '@shared/components/theme-toggle/theme-toggle.component';
import { MotorcycleSceneComponent } from './motorcycle-scene/motorcycle-scene.component';

interface Highlight {
  icon: IconName;
  title: string;
  text: string;
}

/**
 * Split-screen shell for /auth/* pages: an animated brand panel on one side,
 * the routed form on the other. The panel is decorative (aria-hidden) and
 * collapses away on small screens, where the logo moves above the form.
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    LogoComponent,
    ThemeToggleComponent,
    IconComponent,
    MotorcycleSceneComponent,
  ],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss',
})
export class AuthLayoutComponent {
  protected readonly year = new Date().getFullYear();
  protected readonly appName = environment.appName;

  protected readonly highlights: readonly Highlight[] = [
    { icon: 'pulse', title: 'متابعة لحظية', text: 'راقب أسطول الدراجات وحالتها أولًا بأول.' },
    { icon: 'route', title: 'رحلات أذكى', text: 'تحليلات واضحة لكل رحلة ومحطة.' },
    { icon: 'shield', title: 'صلاحيات آمنة', text: 'تحكم دقيق في وصول كل فريق.' },
  ];
}
