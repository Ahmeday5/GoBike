import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { ApiService } from '../services/api.service';
import { withSilentErrors, withSkipLoader } from '../http/http-context.tokens';
import { asList } from '../utils/api-list.util';
import { DriverDto, MotorcycleDto, OfficeDto, StaffUserDto } from '../models/domain.models';

const LOOKUP_PAGE_SIZE = 100;
const QUIET = () => withSilentErrors(withSkipLoader());

/**
 * Small lists that feed dropdowns/pickers across features (offices,
 * supervisors, rentable motorcycles, drivers). Offices and staff are cached
 * per session; searches are live. Failures degrade to an empty list — a
 * picker should never break the form it lives in.
 */
@Injectable({ providedIn: 'root' })
export class LookupService {
  private readonly api = inject(ApiService);

  private offices$?: Observable<OfficeDto[]>;
  private staff$?: Observable<StaffUserDto[]>;

  /** Active offices (cached). */
  offices(): Observable<OfficeDto[]> {
    this.offices$ ??= this.api
      .get<unknown>('offices', {
        params: { isActive: true, pageSize: LOOKUP_PAGE_SIZE, sortBy: 'name' },
        context: QUIET(),
      })
      .pipe(
        map((r) => asList<OfficeDto>(r)),
        catchError(() => of([])),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.offices$;
  }

  /** Active dashboard staff — supervisors, office managers (cached). */
  staff(): Observable<StaffUserDto[]> {
    this.staff$ ??= this.api
      .get<unknown>('users', {
        params: { isActive: true, pageSize: LOOKUP_PAGE_SIZE, sortBy: 'name' },
        context: QUIET(),
      })
      .pipe(
        map((r) => asList<StaffUserDto>(r)),
        catchError(() => of([])),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.staff$;
  }

  /** Motorcycles matching a search (optionally only `Available` ones, for new rentals). */
  motorcycles(search = '', onlyAvailable = false): Observable<MotorcycleDto[]> {
    return this.api
      .get<unknown>('motorcycles', {
        params: { search, status: onlyAvailable ? 'Available' : '', pageSize: 30, sortBy: 'plate' },
        context: QUIET(),
      })
      .pipe(
        map((r) => asList<MotorcycleDto>(r)),
        catchError(() => of([])),
      );
  }

  /** Drivers matching a search (name, phone, national id, licence). */
  drivers(search = '', onlyActive = true): Observable<DriverDto[]> {
    return this.api
      .get<unknown>('drivers', {
        params: { search, status: onlyActive ? 'Active' : '', pageSize: 30, sortBy: 'name' },
        context: QUIET(),
      })
      .pipe(
        map((r) => asList<DriverDto>(r)),
        catchError(() => of([])),
      );
  }

  /** Forget cached lists (after creating/editing an office or user). */
  invalidate(): void {
    this.offices$ = undefined;
    this.staff$ = undefined;
  }
}
