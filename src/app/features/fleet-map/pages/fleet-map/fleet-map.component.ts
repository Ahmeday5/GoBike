import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import type * as Leaflet from 'leaflet';
import { AuthService } from '@core/auth/services/auth.service';
import { APP_ROUTES } from '@core/constants/app-routes';
import { MOTORCYCLE_STATUS, enumOptions } from '@core/constants/enums';
import { LookupService } from '@core/data/lookup.service';
import { createResource } from '@core/data/resource';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { FleetMapItem } from '@core/realtime/realtime.models';
import { injectUrlState } from '@core/routing/url-state';
import { IconComponent } from '@shared/components/icon/icon.component';
import { L } from '@shared/map/leaflet-loader';
import { MapReadyEvent, MapViewComponent } from '@shared/map/map-view.component';
import { CairoDatePipe } from '@shared/pipes/format.pipes';
import { FleetMapApi } from '../../data-access/fleet-map.api';
import {
  FLEET_MAP_QUERY_DEFAULTS,
  FleetMapQuery,
  hasPosition,
  isOffline,
} from '../../models/fleet-map.models';
import { FleetListComponent } from '../../components/fleet-list/fleet-list.component';
import { cardHtml, markerHtml, markerKey } from './fleet-map.markers';

interface MarkerEntry {
  marker: Leaflet.Marker;
  key: string;
  course: number | null;
  frame: number;
}

/** Live positions layered over the last full load, valid only for that load. */
interface LiveOverlay {
  base: FleetMapItem[] | undefined;
  items: ReadonlyMap<string, FleetMapItem>;
}

const MOVE_MS = 1200;
const FLY_ZOOM = 16;

/**
 * 5.1 — Live map. One `GET /fleet/map`, then the hub keeps it fresh:
 * `locationsUpdated` batches are merged by id and markers glide to their new
 * position; `motorcycleHealthChanged` recolors in place. Markers are updated,
 * never recreated, so an open hover card or the user's viewport survive.
 */
@Component({
  selector: 'app-fleet-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MapViewComponent, FleetListComponent, IconComponent, CairoDatePipe],
  templateUrl: './fleet-map.component.html',
  styleUrl: './fleet-map.component.scss',
})
export class FleetMapComponent {
  private readonly api = inject(FleetMapApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  protected readonly hub = inject(DashboardHubService);

  protected readonly statusOptions = enumOptions(MOTORCYCLE_STATUS);
  protected readonly filters = injectUrlState<FleetMapQuery>(FLEET_MAP_QUERY_DEFAULTS);
  protected readonly f = this.filters.state;

  protected readonly canPickOffice = computed(() => !!this.auth.currentUser()?.hasGlobalScope);
  protected readonly offices = toSignal(inject(LookupService).offices(), { initialValue: [] });

  /** Only office/status hit the server — health & offline filter instantly on the client. */
  private readonly serverQuery = computed(
    () => ({ officeId: this.f().officeId, status: this.f().status }),
    { equal: (a, b) => a.officeId === b.officeId && a.status === b.status },
  );

  protected readonly fleet = createResource(
    () => this.serverQuery(),
    (q) => this.api.list(q),
    { refetchOn: this.hub.reconnected$ },
  );

  private readonly live = signal<LiveOverlay>({ base: undefined, items: new Map() });
  protected readonly lastLiveAt = signal<Date | null>(null);

  /** Last load + live updates received since. */
  private readonly items = computed(() => {
    const base = this.fleet.value() ?? [];
    const live = this.live();
    if (live.base !== this.fleet.value() || live.items.size === 0) return base;
    const byId = new Map(base.map((m) => [m.motorcycleId, m]));
    for (const [id, m] of live.items) byId.set(id, m);
    return [...byId.values()];
  });

  /** Office/status scope — what the counters count. */
  private readonly scoped = computed(() => {
    const { officeId, status } = this.f();
    return this.items().filter(
      (m) => (!officeId || m.officeId === officeId) && (!status || m.status === status),
    );
  });

  protected readonly counts = computed(() => {
    const list = this.scoped();
    let green = 0;
    let red = 0;
    let offline = 0;
    for (const m of list) {
      if (m.health === 'Red') red++;
      else green++;
      if (isOffline(m)) offline++;
    }
    return { total: list.length, green, red, offline };
  });

  private readonly visible = computed(() => {
    const { health, view } = this.f();
    return this.scoped().filter(
      (m) => (!health || m.health === health) && (view !== 'offline' || isOffline(m)),
    );
  });
  protected readonly placed = computed(() => this.visible().filter(hasPosition));
  protected readonly unplaced = computed(() => this.visible().filter((m) => !hasPosition(m)));

  protected readonly hasFilters = computed(() => {
    const f = this.f();
    return !!(f.officeId || f.status || f.health || f.view);
  });

  /** Tablet/phone: the side list is a drawer over the map. */
  protected readonly drawerOpen = signal(false);

  private readonly mapReady = signal(false);
  private map: Leaflet.Map | null = null;
  private leaflet: L | null = null;
  private layer: Leaflet.LayerGroup | null = null;
  private readonly markers = new Map<string, MarkerEntry>();
  /** Latest data per marker — hover cards read it when they open. */
  private readonly latest = new Map<string, FleetMapItem>();
  /** Fit once per server query; later updates keep the user's viewport. */
  private fittedFor: string | null = null;
  private readonly reducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    this.hub.locationsUpdated$
      .pipe(takeUntilDestroyed())
      .subscribe((batch) => this.mergeLive(Array.isArray(batch) ? batch : []));

    this.hub.motorcycleHealthChanged$.pipe(takeUntilDestroyed()).subscribe((e) => {
      const current = this.items().find((m) => m.motorcycleId === e?.motorcycleId);
      if (current) this.mergeLive([{ ...current, status: e.status, health: e.health }]);
    });

    effect(() => {
      const items = this.placed();
      if (!this.mapReady()) return;
      const queryKey = JSON.stringify(this.serverQuery());
      const loaded = this.fleet.value() !== undefined;
      untracked(() => this.zone.runOutsideAngular(() => this.sync(items, loaded, queryKey)));
    });

    inject(DestroyRef).onDestroy(() => {
      for (const e of this.markers.values()) cancelAnimationFrame(e.frame);
      this.markers.clear();
      this.latest.clear();
      this.map = null;
    });
  }

  // ─────────────── UI ───────────────

  protected selectStatus(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as FleetMapQuery['status'];
    this.filters.patch({ status: value });
  }

  protected selectOffice(event: Event): void {
    this.filters.patch({ officeId: (event.target as HTMLSelectElement).value });
  }

  /** Counters double as quick filters; clicking the active one clears it. */
  protected toggleCounter(kind: 'total' | 'Green' | 'Red' | 'offline'): void {
    const { health, view } = this.f();
    if (kind === 'total') this.filters.patch({ health: '', view: '' });
    else if (kind === 'offline') this.filters.patch({ health: '', view: view ? '' : 'offline' });
    else this.filters.patch({ view: '', health: health === kind ? '' : kind });
  }

  protected open(m: FleetMapItem): void {
    void this.router.navigateByUrl(APP_ROUTES.motorcycle(m.motorcycleId) as string);
  }

  protected locate(m: FleetMapItem): void {
    this.drawerOpen.set(false);
    const entry = this.markers.get(m.motorcycleId);
    const map = this.map;
    if (!entry || !map) return;
    this.zone.runOutsideAngular(() => {
      map.flyTo(entry.marker.getLatLng(), Math.max(map.getZoom(), FLY_ZOOM), { duration: 0.8 });
      map.once('moveend', () => entry.marker.openTooltip());
    });
  }

  protected fitAll(): void {
    this.zone.runOutsideAngular(() => this.fit());
  }

  // ─────────────── Map ───────────────

  protected onMap({ map, L: leaflet }: MapReadyEvent): void {
    this.map = map;
    this.leaflet = leaflet;
    this.zone.runOutsideAngular(() => {
      this.layer = leaflet.layerGroup().addTo(map);
    });
    this.mapReady.set(true);
  }

  private mergeLive(batch: FleetMapItem[]): void {
    if (!batch.length) return;
    const base = this.fleet.value();
    const known = new Map(this.items().map((m) => [m.motorcycleId, m]));
    this.live.update((live) => {
      const items = new Map(live.base === base ? live.items : []);
      for (const m of batch) {
        if (!m?.motorcycleId) continue;
        items.set(m.motorcycleId, { ...known.get(m.motorcycleId), ...m });
      }
      return { base, items };
    });
    this.lastLiveAt.set(new Date());
  }

  private sync(items: FleetMapItem[], loaded: boolean, queryKey: string): void {
    const leaflet = this.leaflet;
    const layer = this.layer;
    if (!leaflet || !layer) return;

    const seen = new Set<string>();
    for (const m of items) {
      const id = m.motorcycleId;
      const to: [number, number] = [m.latitude!, m.longitude!];
      seen.add(id);
      this.latest.set(id, m);

      const entry = this.markers.get(id);
      if (!entry) {
        const marker = leaflet
          .marker(to, { icon: this.icon(m), title: m.plateNumber, riseOnHover: true })
          .bindTooltip(() => cardHtml(this.latest.get(id) ?? m), {
            className: 'map-tooltip',
            direction: 'top',
            sticky: false,
            opacity: 1,
          })
          .on('click', () => this.zone.run(() => this.open(this.latest.get(id) ?? m)))
          .addTo(layer);
        this.markers.set(id, { marker, key: markerKey(m), course: m.course ?? null, frame: 0 });
        continue;
      }

      const key = markerKey(m);
      if (key !== entry.key) {
        entry.marker.setIcon(this.icon(m));
        entry.key = key;
      } else if ((m.course ?? null) !== entry.course) {
        // Same look, new heading: rotate in place so the CSS transition animates it.
        const arrow = entry.marker.getElement()?.querySelector<HTMLElement>('.moto-marker__arrow');
        if (arrow) arrow.style.transform = `rotate(${Math.round(m.course ?? 0)}deg)`;
      }
      entry.course = m.course ?? null;
      this.glide(entry, to);
    }

    for (const [id, entry] of this.markers) {
      if (seen.has(id)) continue;
      cancelAnimationFrame(entry.frame);
      layer.removeLayer(entry.marker);
      this.markers.delete(id);
      this.latest.delete(id);
    }

    if (loaded && this.fittedFor !== queryKey && items.length) {
      this.fittedFor = queryKey;
      this.fit();
    }
  }

  private icon(m: FleetMapItem): Leaflet.DivIcon {
    return this.leaflet!.divIcon({
      html: markerHtml(m),
      className: 'fleet-marker',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      tooltipAnchor: [0, -20],
    });
  }

  /** Eases a marker to its new position instead of jumping. */
  private glide(entry: MarkerEntry, to: [number, number]): void {
    const from = entry.marker.getLatLng();
    if (from.lat === to[0] && from.lng === to[1]) return;
    cancelAnimationFrame(entry.frame);
    if (this.reducedMotion) {
      entry.marker.setLatLng(to);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / MOVE_MS);
      const e = 1 - (1 - k) ** 3;
      entry.marker.setLatLng([from.lat + (to[0] - from.lat) * e, from.lng + (to[1] - from.lng) * e]);
      entry.frame = k < 1 ? requestAnimationFrame(step) : 0;
    };
    entry.frame = requestAnimationFrame(step);
  }

  private fit(): void {
    const map = this.map;
    const leaflet = this.leaflet;
    if (!map || !leaflet || !this.markers.size) return;
    const bounds = leaflet.latLngBounds(
      [...this.markers.values()].map((e) => e.marker.getLatLng()),
    );
    map.fitBounds(bounds.pad(0.15), { maxZoom: FLY_ZOOM, animate: true });
  }
}
