import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { MAINTENANCE_TYPE, enumLabel } from '@core/constants/enums';
import { LookupService } from '@core/data/lookup.service';
import { withSilentErrors, withSkipLoader } from '@core/http/http-context.tokens';
import {
  DriverDto,
  MaintenanceRecordDto,
  MotorcycleDto,
  OfficeDto,
  RentalDto,
} from '@core/models/domain.models';
import { ApiService } from '@core/services/api.service';
import { asList } from '@core/utils/api-list.util';
import { formatCairo } from '@core/utils/cairo-time.util';
import { PickerOption } from '@shared/components/remote-picker/remote-picker.component';
import { OwnerSourceType } from '../models/documents.models';

const QUIET = () => withSilentErrors(withSkipLoader());
const PAGE = 30;

interface OwnerSource {
  /** Owners matching `term` (all of them, newest/alphabetical first, when empty). */
  search(term: string): Observable<PickerOption[]>;
  /** One owner by id — labels an id that came from the URL. */
  resolve(id: string): Observable<PickerOption | null>;
}

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ');

const motorcycleOption = (m: MotorcycleDto): PickerOption => ({
  value: m.id,
  label: m.plateNumber,
  hint: join(m.brand, m.model, m.officeName),
});
const driverOption = (d: DriverDto): PickerOption => ({
  value: d.id,
  label: d.fullName,
  hint: d.phoneNumber,
});
const rentalOption = (r: RentalDto): PickerOption => ({
  value: r.id,
  label: join(r.plateNumber, r.driverName) || 'إيجار',
  hint: formatCairo(r.startAtUtc, 'date'),
});
const recordOption = (r: MaintenanceRecordDto): PickerOption => ({
  value: r.id,
  label: join(r.plateNumber, enumLabel(MAINTENANCE_TYPE, r.type)),
  hint: formatCairo(r.scheduledAtUtc ?? r.startedAtUtc ?? r.completedAtUtc, 'date'),
});
const officeOption = (o: OfficeDto): PickerOption => ({
  value: o.id,
  label: o.name,
  hint: join(o.code, o.city),
});

/**
 * Lists the possible owners of a document, per owner type, for the "type →
 * owner" pickers on the documents page. Failures degrade to an empty list or
 * an unlabeled id — a picker must never break the page it lives in.
 */
@Injectable({ providedIn: 'root' })
export class DocumentOwnersLookup {
  private readonly api = inject(ApiService);
  private readonly lookups = inject(LookupService);

  private readonly sources: Record<OwnerSourceType, OwnerSource> = {
    Motorcycle: {
      search: (term) => this.lookups.motorcycles(term).pipe(map((l) => l.map(motorcycleOption))),
      resolve: (id) => this.one<MotorcycleDto>(`motorcycles/${id}`, motorcycleOption),
    },
    Driver: {
      search: (term) => this.lookups.drivers(term, false).pipe(map((l) => l.map(driverOption))),
      resolve: (id) => this.one<DriverDto>(`drivers/${id}`, driverOption),
    },
    RentalAssignment: {
      search: (term) =>
        this.many<RentalDto>('rentals', { search: term, sortBy: 'startAt', sortDesc: true }).pipe(
          map((l) => l.map(rentalOption)),
        ),
      resolve: (id) => this.one<RentalDto>(`rentals/${id}`, rentalOption),
    },
    MaintenanceRecord: {
      search: (term) =>
        this.many<MaintenanceRecordDto>('maintenance/records', {
          search: term,
          sortDesc: true,
        }).pipe(map((l) => l.map(recordOption))),
      resolve: (id) => this.one<MaintenanceRecordDto>(`maintenance/records/${id}`, recordOption),
    },
    Office: {
      search: (term) =>
        this.lookups.offices().pipe(
          map((list) => {
            const t = term.trim().toLowerCase();
            const hits = t
              ? list.filter((o) =>
                  [o.name, o.code, o.city].some((v) => v?.toLowerCase().includes(t)),
                )
              : list;
            return hits.map(officeOption);
          }),
        ),
      resolve: (id) =>
        this.lookups.offices().pipe(
          map((list) => {
            const office = list.find((o) => o.id === id);
            return office ? officeOption(office) : null;
          }),
        ),
    },
  };

  search(type: OwnerSourceType, term: string): Observable<PickerOption[]> {
    return this.sources[type].search(term);
  }

  resolve(type: OwnerSourceType, id: string): Observable<PickerOption | null> {
    return this.sources[type].resolve(id);
  }

  private many<T>(endpoint: string, params: Record<string, unknown>): Observable<T[]> {
    return this.api
      .get<unknown>(endpoint, {
        params: { ...params, pageIndex: 1, pageSize: PAGE },
        context: QUIET(),
      })
      .pipe(
        map((r) => asList<T>(r)),
        catchError(() => of([])),
      );
  }

  private one<T>(
    endpoint: string,
    toOption: (row: T) => PickerOption,
  ): Observable<PickerOption | null> {
    return this.api.get<T>(endpoint, { context: QUIET() }).pipe(
      map((row) => (row ? toOption(row) : null)),
      catchError(() => of(null)),
    );
  }
}
