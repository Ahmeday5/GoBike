import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, map, of } from 'rxjs';
import { AuthService } from '@core/auth/services/auth.service';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { APP_ROUTES } from '@core/constants/app-routes';
import { INSPECTION_RESULT, RENTAL_STATUS, RENT_PERIOD, enumLabel } from '@core/constants/enums';
import { createResource } from '@core/data/resource';
import { InspectionDto } from '@core/models/domain.models';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ChipComponent, EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { DocumentsPanelComponent } from '@shared/components/documents-panel/documents-panel.component';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { CairoDatePipe, MoneyPipe } from '@shared/pipes/format.pipes';
import { RentalsApi } from '../../data-access/rentals.api';
import {
  INSPECTIONS_QUERY_DEFAULTS,
  RentalDetailDto,
  isRentalCancellable,
} from '../../models/rental.models';
import { InspectionReportComponent } from '../../components/inspection-report/inspection-report.component';
import { ReturnRentalDialogComponent } from '../../components/return-rental-dialog/return-rental-dialog.component';
import { CancelRentalDialogComponent } from '../../components/cancel-rental-dialog/cancel-rental-dialog.component';
import { RentalTermsDialogComponent } from '../../components/rental-terms-dialog/rental-terms-dialog.component';

/** 5.6 — One rental: parties, money, terms, cancel info and (once returned) the inspection. */
@Component({
  selector: 'app-rental-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageHeaderComponent,
    ChipComponent,
    EnumChipComponent,
    IconComponent,
    EmptyStateComponent,
    DocumentsPanelComponent,
    HasPermissionDirective,
    CairoDatePipe,
    MoneyPipe,
    InspectionReportComponent,
    ReturnRentalDialogComponent,
    CancelRentalDialogComponent,
    RentalTermsDialogComponent,
  ],
  templateUrl: './rental-detail.component.html',
  styleUrl: './rental-detail.component.scss',
})
export class RentalDetailComponent {
  private readonly api = inject(RentalsApi);
  private readonly auth = inject(AuthService);
  private readonly hub = inject(DashboardHubService);

  /** Route param (component input binding). */
  readonly id = input.required<string>();

  protected readonly P = PERMISSIONS;
  protected readonly STATUS = RENTAL_STATUS;
  protected readonly RESULT = INSPECTION_RESULT;
  protected readonly listLink = APP_ROUTES.rentals;

  protected readonly can = computed(() => ({
    manage: this.auth.hasPermission(PERMISSIONS.Assignments.Manage),
    inspect: this.auth.hasPermission(PERMISSIONS.Inspections.Manage),
    readInspections: this.auth.hasPermission(PERMISSIONS.Inspections.Read),
    motorcycles: this.auth.hasPermission(PERMISSIONS.Motorcycles.Read),
    drivers: this.auth.hasPermission(PERMISSIONS.Drivers.Read),
  }));

  protected readonly rentalRes = createResource(
    () => this.id(),
    (id) => this.api.get(id),
    { refetchOn: this.hub.reconnected$ },
  );
  protected readonly rental = computed(() => this.rentalRes.value() ?? null);
  protected readonly notFound = computed(() => this.rentalRes.error()?.status === 404);
  protected readonly loadFailed = computed(() => {
    const s = this.rentalRes.error()?.status;
    return !!s && s !== 404;
  });

  /**
   * The rental may embed its inspection, or only carry `inspectionId`. If it
   * has neither, find it among the bike + driver's inspections by `rentalId`.
   */
  private readonly inspectionRes = createResource(
    () => {
      const r = this.rental();
      if (!r || r.status !== 'Ended' || r.inspection || !this.can().readInspections) return null;
      return r;
    },
    (r) => this.findInspection(r),
  );
  /** Set from the return dialog so the result shows even before the reload lands. */
  private readonly justReturned = signal<InspectionDto | null>(null);
  protected readonly inspection = computed<InspectionDto | null>(
    () => this.rental()?.inspection ?? this.inspectionRes.value() ?? this.justReturned(),
  );
  protected readonly inspectionLoading = computed(() => this.inspectionRes.loading());

  protected readonly cancellable = computed(() => {
    const r = this.rental();
    return !!r && isRentalCancellable(r);
  });
  protected readonly periodLabel = computed(() =>
    enumLabel(RENT_PERIOD, this.rental()?.rentPeriod),
  );
  protected readonly motorcycleLink = computed(() => {
    const r = this.rental();
    return r && this.can().motorcycles ? APP_ROUTES.motorcycle(r.motorcycleId) : null;
  });
  protected readonly driverLink = computed(() => {
    const r = this.rental();
    return r && this.can().drivers ? APP_ROUTES.driver(r.driverId) : null;
  });
  protected readonly inspectionLink = computed(() => {
    const i = this.inspection();
    return i?.id && this.can().readInspections ? APP_ROUTES.inspection(i.id) : null;
  });

  // ── dialogs ──
  protected readonly returnOpen = signal(false);
  protected readonly cancelOpen = signal(false);
  protected readonly termsOpen = signal(false);

  protected onReturned(i: InspectionDto): void {
    // The dialog stays open on its result screen; the page refreshes beneath it.
    this.justReturned.set(i);
    this.rentalRes.reload();
  }

  protected onCancelled(): void {
    this.cancelOpen.set(false);
    this.rentalRes.reload();
  }

  protected onTermsSaved(): void {
    this.termsOpen.set(false);
    this.rentalRes.reload();
  }

  private findInspection(r: RentalDetailDto): Observable<InspectionDto | null> {
    if (r.inspectionId) return this.api.inspection(r.inspectionId);
    if (!r.motorcycleId || !r.driverId) return of(null);
    return this.api
      .inspections({
        ...INSPECTIONS_QUERY_DEFAULTS,
        motorcycleId: r.motorcycleId,
        driverId: r.driverId,
        pageSize: 50,
      })
      .pipe(map((p) => p.data.find((i) => i.rentalId === r.id) ?? null));
  }
}
