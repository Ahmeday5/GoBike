import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { NavigationService } from '../../services/navigation.service';
import { APP_ROUTES } from '../../constants/app-routes';

/**
 * "/" → the first section this user may open. The live map is first in the
 * menu, but a role without `gps.read` (e.g. an accountant) lands on its own
 * first screen instead of a 403. Falls back to the account page.
 */
export const homeRedirectGuard: CanActivateFn = () => {
  const first = inject(NavigationService).visibleItems()[0];
  return inject(Router).parseUrl(first?.route ?? APP_ROUTES.account);
};
