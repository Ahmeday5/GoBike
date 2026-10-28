import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { asList } from '@core/utils/api-list.util';
import { withSilentErrors, withSkipLoader } from '@core/http/http-context.tokens';
import {
  CreateRoleRequest,
  RoleView,
  UpdateRolePermissionsRequest,
  normalizePermissions,
  normalizeRole,
} from '../models/role.models';

/** Roles and their permissions (`/roles`). Responses are normalized defensively. */
@Injectable({ providedIn: 'root' })
export class RolesApi {
  private readonly api = inject(ApiService);

  list(): Observable<RoleView[]> {
    return this.api.get<unknown>('roles', { context: withSkipLoader() }).pipe(
      map((r) =>
        asList<unknown>(r)
          .map(normalizeRole)
          .filter((x): x is RoleView => !!x),
      ),
    );
  }

  /** Every permission name the backend knows. */
  permissions(): Observable<string[]> {
    return this.api
      .get<unknown>('roles/permissions', { context: withSkipLoader() })
      .pipe(map((r) => normalizePermissions(Array.isArray(r) ? r : asList<unknown>(r))));
  }

  create(body: CreateRoleRequest): Observable<unknown> {
    return this.api.post('roles', body, { context: withSilentErrors() });
  }

  setPermissions(name: string, body: UpdateRolePermissionsRequest): Observable<unknown> {
    return this.api.put(`roles/${encodeURIComponent(name)}/permissions`, body);
  }

  delete(name: string): Observable<unknown> {
    return this.api.delete(`roles/${encodeURIComponent(name)}`);
  }
}
