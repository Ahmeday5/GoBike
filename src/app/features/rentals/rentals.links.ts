import { APP_ROUTES } from '@core/constants/app-routes';

/** Detail URLs APP_ROUTES doesn't define yet (built from its base paths). */
export const rentalLink = (id: string) => `${APP_ROUTES.rentals}/${id}`;
export const inspectionLink = (id: string) => `${APP_ROUTES.inspections}/${id}`;
