import { Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '@core/auth/services/auth.service';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { STAFF_ROLE, enumMeta } from '@core/constants/enums';
import { ChipOption } from '../components/chip-multiselect/chip-multiselect.component';
import { BUILT_IN_ROLES, isReservedRole, roleLabel } from '../models/role.models';
import { RolesApi } from './roles.api';

/**
 * Roles a user can be given: the seeded staff roles plus any custom role from
 * `GET /roles` (only readable with roles.manage — otherwise the seeded list).
 * The reserved `Driver` role is never offered. Call in an injection context.
 */
export function injectRoleOptions(): Signal<ChipOption[]> {
  const auth = inject(AuthService);
  const api = inject(RolesApi);
  const fromApi = auth.hasPermission(PERMISSIONS.Roles.Manage)
    ? api.list(true).pipe(
        map((roles) => roles.map((r) => r.name)),
        catchError(() => of<string[]>([])),
      )
    : of<string[]>([]);
  const names = toSignal(fromApi, { initialValue: [] as string[] });

  return computed(() => {
    const all = [...BUILT_IN_ROLES];
    for (const n of names()) {
      if (!all.some((x) => x.toLowerCase() === n.toLowerCase())) all.push(n);
    }
    return all
      .filter((n) => !isReservedRole(n))
      .map((n) => ({
        value: n,
        label: roleLabel(n),
        icon: enumMeta(STAFF_ROLE, n).icon ?? 'shield',
      }));
  });
}
