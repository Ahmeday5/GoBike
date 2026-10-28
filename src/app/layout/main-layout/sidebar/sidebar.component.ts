import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LayoutService } from '@core/services/layout.service';
import { NavigationService } from '@core/services/navigation.service';
import { AuthService } from '@core/auth/services/auth.service';
import { MenuItem } from '@core/models/menu-item.model';
import { APP_ROUTES } from '@core/constants/app-routes';
import { STAFF_ROLE, enumLabel } from '@core/constants/enums';
import { environment } from '@env/environment';
import { IconComponent, IconName } from '@shared/components/icon/icon.component';
import { LogoComponent } from '@shared/components/logo/logo.component';

interface IndicatorBox {
  top: number;
  height: number;
}

interface Tip {
  label: string;
  top: number;
  right: number;
}

/** Gap between the collapsed rail and its tooltip. */
const TIP_GAP_PX = 12;

@Component({
  selector: 'app-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, IconComponent, LogoComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  protected readonly layout = inject(LayoutService);
  protected readonly visibleSections = inject(NavigationService).visibleSections;
  protected readonly user = inject(AuthService).currentUser;
  protected readonly routes = APP_ROUTES;
  protected readonly appVersion = environment.appVersion;

  protected readonly isCollapsed = computed(
    () => this.layout.collapsed() && !this.layout.isMobile(),
  );
  protected readonly roleLabel = computed(() => enumLabel(STAFF_ROLE, this.user()?.role));

  /**
   * Position of the active-item highlight. A single absolutely-positioned
   * element glides between items instead of each item fading its own
   * background — that's what makes navigation feel continuous.
   */
  protected readonly indicator = signal<IndicatorBox | null>(null);
  private activeEl: HTMLElement | null = null;

  /** Label bubble beside the collapsed rail. */
  protected readonly tip = signal<Tip | null>(null);

  protected onActiveChange(active: boolean, el: HTMLElement): void {
    if (active) {
      this.activeEl = el;
      this.indicator.set({ top: el.offsetTop, height: el.offsetHeight });
    } else if (this.activeEl === el) {
      // Navigated somewhere without a sidebar entry (e.g. a detail page).
      this.activeEl = null;
      this.indicator.set(null);
    }
  }

  protected showTip(label: string, el: HTMLElement): void {
    if (!this.isCollapsed()) return;
    const rect = el.getBoundingClientRect();
    // RTL: the rail is on the right, so the tip opens to its left.
    this.tip.set({
      label,
      top: rect.top + rect.height / 2,
      right: window.innerWidth - rect.left + TIP_GAP_PX,
    });
  }

  protected hideTip(): void {
    this.tip.set(null);
  }

  protected onNavigate(): void {
    this.hideTip();
    this.layout.closeMobile();
  }

  protected iconName(item: MenuItem): IconName | string {
    return item.icon ?? 'grid';
  }

  /** Running index across sections, for the staggered entrance animation. */
  protected staggerIndex(sectionIndex: number, itemIndex: number): number {
    const before = this.visibleSections()
      .slice(0, sectionIndex)
      .reduce((n, s) => n + s.items.length + 1, 0);
    return before + itemIndex + 1;
  }
}
