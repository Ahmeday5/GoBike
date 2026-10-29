import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/services/auth.service';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { APP_ROUTES } from '@core/constants/app-routes';
import { INSPECTION_RESULT } from '@core/constants/enums';
import { createResource } from '@core/data/resource';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { CairoDatePipe } from '@shared/pipes/format.pipes';
import { RentalsApi } from '../../data-access/rentals.api';
import { InspectionReportComponent } from '../../components/inspection-report/inspection-report.component';

/** One return inspection: result, faults, summary, notes + links to the rental and repair. */
@Component({
  selector: 'app-inspection-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageHeaderComponent,
    EnumChipComponent,
    IconComponent,
    EmptyStateComponent,
    CairoDatePipe,
    InspectionReportComponent,
  ],
  templateUrl: './inspection-detail.component.html',
  styleUrl: '../rental-detail/rental-detail.component.scss',
})
export class InspectionDetailComponent {
  private readonly api = inject(RentalsApi);
  private readonly auth = inject(AuthService);

  /** Route param (component input binding). */
  readonly id = input.required<string>();

  protected readonly RESULT = INSPECTION_RESULT;
  protected readonly listLink = APP_ROUTES.inspections;

  protected readonly res = createResource(
    () => this.id(),
    (id) => this.api.inspection(id),
    { refetchOn: inject(DashboardHubService).reconnected$ },
  );
  protected readonly inspection = computed(() => this.res.value() ?? null);
  protected readonly notFound = computed(() => this.res.error()?.status === 404);
  protected readonly loadFailed = computed(() => {
    const s = this.res.error()?.status;
    return !!s && s !== 404;
  });

  protected readonly links = computed(() => {
    const i = this.inspection();
    const can = (p: string) => this.auth.hasPermission(p);
    return {
      motorcycle:
        i && can(PERMISSIONS.Motorcycles.Read) ? APP_ROUTES.motorcycle(i.motorcycleId) : null,
      driver: i?.driverId && can(PERMISSIONS.Drivers.Read) ? APP_ROUTES.driver(i.driverId) : null,
      rental:
        i?.rentalId && can(PERMISSIONS.Assignments.Read) ? APP_ROUTES.rental(i.rentalId) : null,
      repair:
        i?.maintenanceRecordId && can(PERMISSIONS.Maintenance.Read)
          ? APP_ROUTES.maintenanceRecord(i.maintenanceRecordId)
          : null,
    };
  });
}
