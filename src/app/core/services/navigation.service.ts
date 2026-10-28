import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from '../auth/services/auth.service';
import { NAV_SECTIONS } from '../constants/nav.constants';
import { MenuItem, MenuSection } from '../models/menu-item.model';

/**
 * The navigation the current user may see — `NAV_SECTIONS` filtered by
 * roles/permissions. Shared by the sidebar and any in-page shortcuts so the
 * visibility rules live in exactly one place.
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly auth = inject(AuthService);

  /**
   * Recomputes whenever the user's permission set changes (login, cross-tab
   * session refresh). Sections whose items are all hidden are dropped so we
   * never render orphan headers.
   */
  readonly visibleSections = computed<MenuSection[]>(() => {
    const permissions = this.auth.permissionSet();
    const role = this.auth.currentUser()?.role;
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => isVisible(item, permissions, role)),
    })).filter((section) => section.items.length > 0);
  });

  readonly visibleItems = computed<MenuItem[]>(() =>
    this.visibleSections().flatMap((section) => section.items),
  );
}

function isVisible(
  item: MenuItem,
  permissions: ReadonlySet<string>,
  role: string | undefined,
): boolean {
  const hasPermGate = !!item.permissions?.length;
  const hasRoleGate = !!item.roles?.length;
  // No gate at all → visible to everyone.
  if (!hasPermGate && !hasRoleGate) return true;
  // Gates are OR-ed: an item declaring both shows when the user satisfies *either*.
  const permMatch = hasPermGate && item.permissions!.some((p) => permissions.has(p));
  const roleMatch = hasRoleGate && !!role && item.roles!.includes(role);
  return permMatch || roleMatch;
}
