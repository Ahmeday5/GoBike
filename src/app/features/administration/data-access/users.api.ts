import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { PagedResponse } from '@core/models/api-response.model';
import { StaffUserDto } from '@core/models/domain.models';
import { toPaged } from '@core/utils/api-list.util';
import { withSilentErrors, withSkipLoader } from '@core/http/http-context.tokens';
import {
  AdminResetPasswordRequest,
  CreateUserRequest,
  SetUserRolesRequest,
  UpdateUserRequest,
  UsersQuery,
} from '../models/user.models';

/** Dashboard staff accounts (`/users`). Drivers are not users — they live under /drivers. */
@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly api = inject(ApiService);

  list(query: UsersQuery): Observable<PagedResponse<StaffUserDto>> {
    return this.api
      .get<unknown>('users', { params: { ...query }, context: withSkipLoader() })
      .pipe(toPaged<StaffUserDto>());
  }

  create(body: CreateUserRequest): Observable<StaffUserDto> {
    return this.api.post<StaffUserDto>('users', body, { context: withSilentErrors() });
  }

  update(id: string, body: UpdateUserRequest): Observable<StaffUserDto> {
    return this.api.put<StaffUserDto>(`users/${id}`, body, { context: withSilentErrors() });
  }

  setRoles(id: string, body: SetUserRolesRequest): Observable<unknown> {
    return this.api.put(`users/${id}/roles`, body, { context: withSilentErrors() });
  }

  resetPassword(id: string, body: AdminResetPasswordRequest): Observable<unknown> {
    return this.api.post(`users/${id}/reset-password`, body, { context: withSilentErrors() });
  }

  activate(id: string): Observable<unknown> {
    return this.api.post(`users/${id}/activate`, {});
  }

  deactivate(id: string): Observable<unknown> {
    return this.api.post(`users/${id}/deactivate`, {});
  }

  delete(id: string): Observable<unknown> {
    return this.api.delete(`users/${id}`);
  }
}
