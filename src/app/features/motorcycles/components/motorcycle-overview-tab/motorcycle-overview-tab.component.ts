import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { APP_ROUTES } from '@core/constants/app-routes';
import {
  GPS_CONNECTIVITY,
  GPS_INCIDENT_TYPE,
  INCIDENT_STATUS,
  INSPECTION_RESULT,
  MAINTENANCE_ALERT_LEVEL,
  MAINTENANCE_STATUS,
  OIL_CHANGE_STATUS,
} from '@core/constants/enums';
import { ChipComponent, EnumChipComponent } from '@shared/components/chip/chip.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { CairoDatePipe, KmPipe, MoneyPipe, NumberPipe } from '@shared/pipes/format.pipes';
import { MotorcycleOverviewDto } from '../../models/motorcycle-overview.models';
import { OilStatusBarComponent } from '../oil-status-bar/oil-status-bar.component';
import {
  MiniMapPosition,
  MotorcycleMiniMapComponent,
} from '../motorcycle-mini-map/motorcycle-mini-map.component';
import { formatMeters } from '../../utils/gps-window';

/** Motorcycle page → overview tab: mini map + every summary panel from the overview call. */
@Component({
  selector: 'app-motorcycle-overview-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ChipComponent,
    EnumChipComponent,
    EmptyStateComponent,
    IconComponent,
    HasPermissionDirective,
    CairoDatePipe,
    KmPipe,
    MoneyPipe,
    NumberPipe,
    OilStatusBarComponent,
    MotorcycleMiniMapComponent,
  ],
  templateUrl: './motorcycle-overview-tab.component.html',
  styleUrl: './motorcycle-overview-tab.component.scss',
})
export class MotorcycleOverviewTabComponent {
  readonly overview = input.required<MotorcycleOverviewDto>();

  protected readonly P = PERMISSIONS;
  protected readonly R = APP_ROUTES;
  protected readonly CONNECTIVITY = GPS_CONNECTIVITY;
  protected readonly INCIDENT_TYPE = GPS_INCIDENT_TYPE;
  protected readonly INCIDENT_STATUS = INCIDENT_STATUS;
  protected readonly INSPECTION = INSPECTION_RESULT;
  protected readonly ALERT_LEVEL = MAINTENANCE_ALERT_LEVEL;
  protected readonly MAINT_STATUS = MAINTENANCE_STATUS;
  protected readonly OIL_SUBMISSION = OIL_CHANGE_STATUS;

  protected readonly m = computed(() => this.overview().motorcycle);
  protected readonly loc = computed(() => this.overview().location ?? null);
  protected readonly rental = computed(() => this.overview().currentRental ?? null);
  protected readonly oil = computed(() => this.overview().oilStatus ?? null);
  protected readonly zone = computed(() => this.overview().zone ?? null);
  protected readonly alerts = computed(() => this.overview().openAlerts ?? []);
  protected readonly incidents = computed(() => this.overview().openIncidents ?? []);

  protected readonly hasFix = computed(() => {
    const l = this.loc();
    return (
      !!l && l.latitude != null && l.longitude != null && !(l.latitude === 0 && l.longitude === 0)
    );
  });

  protected readonly position = computed<MiniMapPosition | null>(() => {
    const l = this.loc();
    if (!l || !this.hasFix()) return null;
    return {
      lat: l.latitude!,
      lng: l.longitude!,
      course: l.course,
      red: this.overview().health === 'Red',
      stale: !!l.isStale,
      label: this.m().plateNumber,
    };
  });

  protected readonly battery = computed(() => {
    const l = this.loc();
    return l?.batteryPercent ?? l?.batteryLevel ?? null;
  });
  protected readonly volts = computed(() => {
    const l = this.loc();
    return l?.externalVoltage ?? l?.externalVolts ?? null;
  });
  protected readonly lastSeen = computed(() => {
    const l = this.loc();
    return l?.lastGpsAtUtc ?? l?.recordedAtUtc ?? null;
  });

  protected readonly rentalId = computed(() => {
    const r = this.rental();
    return r?.rentalId ?? r?.id ?? null;
  });

  protected readonly zoneRadius = computed(() => formatMeters(this.zone()?.radiusMeters));
  protected readonly zoneDistance = computed(() =>
    formatMeters(this.zone()?.distanceFromCenterMeters),
  );
}
