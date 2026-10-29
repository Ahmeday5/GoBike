import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  untracked,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { filter, merge } from 'rxjs';
import type * as Leaflet from 'leaflet';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { APP_ROUTES } from '@core/constants/app-routes';
import { GPS_INCIDENT_TYPE, INCIDENT_STATUS, enumLabel } from '@core/constants/enums';
import { createResource } from '@core/data/resource';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { ToastService } from '@core/services/toast.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { EnumChipComponent, ChipComponent } from '@shared/components/chip/chip.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { MapReadyEvent, MapViewComponent } from '@shared/map/map-view.component';
import { CairoDatePipe } from '@shared/pipes/format.pipes';
import { AlertsApi } from '../../data-access/alerts.api';
import {
  AUTO_RESOLVING_TYPES,
  SUSPECTED_POWER_HINT,
  incidentPosition,
  incidentStartedAt,
} from '../../models/alerts.models';
import { ResolveIncidentDialogComponent } from '../../components/resolve-incident-dialog/resolve-incident-dialog.component';

interface TimelineStep {
  icon: string;
  tone: 'danger' | 'info' | 'success' | 'neutral';
  title: string;
  at: string | null | undefined;
  by?: string | null;
  note?: string | null;
}

/** 5.9 — One GPS / power / zone incident: chips, timeline, last known position, actions. */
@Component({
  selector: 'app-incident-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageHeaderComponent,
    EnumChipComponent,
    ChipComponent,
    EmptyStateComponent,
    IconComponent,
    HasPermissionDirective,
    MapViewComponent,
    CairoDatePipe,
    ResolveIncidentDialogComponent,
  ],
  templateUrl: './incident-detail.component.html',
  styleUrl: './incident-detail.component.scss',
})
export class IncidentDetailComponent {
  private readonly api = inject(AlertsApi);
  private readonly hub = inject(DashboardHubService);
  private readonly toast = inject(ToastService);

  /** Route param (component input binding). */
  readonly id = input.required<string>();

  protected readonly P = PERMISSIONS;
  protected readonly TYPE = GPS_INCIDENT_TYPE;
  protected readonly STATUS = INCIDENT_STATUS;
  protected readonly SUSPECTED_HINT = SUSPECTED_POWER_HINT;
  protected readonly motorcycleLink = (id: string) => APP_ROUTES.motorcycle(id);
  protected readonly driverLink = APP_ROUTES.driver;

  protected readonly res = createResource(
    () => this.id(),
    (id) => this.api.incident(id),
    {
      // Auto-resolution arrives as an incident notification — keep the page current.
      refetchOn: merge(
        this.hub.reconnected$,
        this.hub.notification$.pipe(
          filter((n) => n.relatedEntityType === 'GpsIncident' && n.relatedEntityId === this.id()),
        ),
      ),
    },
  );
  protected readonly incident = computed(() => this.res.value() ?? null);
  protected readonly notFound = computed(() => this.res.error()?.status === 404);

  protected readonly backLink = APP_ROUTES.alerts;
  protected readonly title = computed(() => {
    const i = this.incident();
    return i ? enumLabel(GPS_INCIDENT_TYPE, i.type) : 'تفاصيل الحادثة';
  });
  protected readonly position = computed(() => {
    const i = this.incident();
    return i ? incidentPosition(i) : null;
  });
  protected readonly autoResolves = computed(() => {
    const i = this.incident();
    return !!i && i.status !== 'Resolved' && AUTO_RESOLVING_TYPES.includes(i.type);
  });

  protected readonly timeline = computed<TimelineStep[]>(() => {
    const i = this.incident();
    if (!i) return [];
    const steps: TimelineStep[] = [
      { icon: 'alert', tone: 'danger', title: 'بدأت الحادثة', at: incidentStartedAt(i) },
    ];
    if (i.lastSeenAtUtc) {
      steps.push({ icon: 'clock', tone: 'neutral', title: 'آخر ظهور', at: i.lastSeenAtUtc });
    }
    if (i.acknowledgedAtUtc) {
      steps.push({
        icon: 'eye',
        tone: 'info',
        title: 'تم الاطلاع',
        at: i.acknowledgedAtUtc,
        by: i.acknowledgedByName,
      });
    }
    if (i.resolvedAtUtc || i.status === 'Resolved') {
      steps.push({
        icon: 'check-circle',
        tone: 'success',
        title: i.autoResolved ? 'أُغلقت تلقائيًا' : 'تم الحل',
        at: i.resolvedAtUtc,
        by: i.autoResolved ? null : i.resolvedByName,
        note: i.resolutionNotes,
      });
    }
    return steps.sort((a, b) => Date.parse(a.at ?? '') - Date.parse(b.at ?? '') || 0);
  });

  protected readonly busy = signal(false);
  protected readonly resolving = signal(false);

  private map: Leaflet.Map | null = null;
  private leaflet: MapReadyEvent['L'] | null = null;
  private marker: Leaflet.Marker | null = null;

  constructor() {
    // Keep the marker on the last known position as the incident reloads.
    effect(() => {
      const pos = this.position();
      untracked(() => this.placeMarker(pos));
    });
  }

  protected onMap({ map, L }: MapReadyEvent): void {
    this.map = map;
    this.leaflet = L;
    this.marker = null;
    this.placeMarker(this.position());
  }

  protected acknowledge(): void {
    const i = this.incident();
    if (!i) return;
    this.busy.set(true);
    this.api.acknowledgeIncident(i.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success('تم تسجيل الاطلاع على الحادثة');
        this.res.reload();
      },
      error: () => this.busy.set(false),
    });
  }

  protected onResolved(): void {
    this.resolving.set(false);
    this.res.reload();
  }

  private placeMarker(pos: [number, number] | null): void {
    if (!this.map || !this.leaflet) return;
    if (!pos) {
      // The map is only rendered while there is a position; drop the stale refs.
      this.marker = null;
      this.map = null;
      return;
    }
    if (this.marker) {
      this.marker.setLatLng(pos);
    } else {
      this.marker = this.leaflet
        .marker(pos, {
          icon: this.leaflet.divIcon({
            className: '',
            html: '<span class="dot-marker dot-marker--end"></span>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
          keyboard: false,
        })
        .addTo(this.map);
    }
    this.map.setView(pos, Math.max(this.map.getZoom(), 15));
  }
}
