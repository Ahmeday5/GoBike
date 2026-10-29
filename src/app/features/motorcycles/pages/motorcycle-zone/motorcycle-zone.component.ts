import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type * as Leaflet from 'leaflet';
import { APP_ROUTES } from '@core/constants/app-routes';
import { createResource } from '@core/data/resource';
import { ApiError } from '@core/models/api-response.model';
import { DialogService } from '@core/services/dialog.service';
import { ToastService } from '@core/services/toast.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { L } from '@shared/map/leaflet-loader';
import { MapReadyEvent, MapViewComponent } from '@shared/map/map-view.component';
import { CairoDatePipe } from '@shared/pipes/format.pipes';
import { MotorcyclesApi } from '../../data-access/motorcycles.api';
import { MotorcycleZoneDto } from '../../models/motorcycle-overview.models';
import {
  bearingDeg,
  bikeMarkerHtml,
  cssVar,
  destinationPoint,
  distanceMeters,
  formatMeters,
} from '../../utils/gps-window';

export const MIN_RADIUS_M = 100;
export const MAX_RADIUS_M = 200_000;
const DEFAULT_RADIUS_M = 2_000;
const SLIDER_STEPS = 1000;
const RADIUS_PRESETS = [500, 1_000, 5_000, 20_000, 50_000];

const clampRadius = (m: number) => Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, Math.round(m)));
/** Log scale: equal slider travel per order of magnitude (100 m → 200 km). */
const toSlider = (m: number) =>
  Math.round((SLIDER_STEPS * Math.log(m / MIN_RADIUS_M)) / Math.log(MAX_RADIUS_M / MIN_RADIUS_M));
const fromSlider = (s: number) =>
  clampRadius(MIN_RADIUS_M * Math.pow(MAX_RADIUS_M / MIN_RADIUS_M, s / SLIDER_STEPS));

/**
 * 5.4 — Zone editor. Click the map to place the center, drag the center or
 * the handle on the circle's edge, or use the (log-scale) slider / number
 * input. The bike's last known position is shown for reference.
 * `PUT /motorcycles/{id}/zone` saves (create or replace); `DELETE` removes.
 */
@Component({
  selector: 'app-motorcycle-zone',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageHeaderComponent,
    ChipComponent,
    IconComponent,
    MapViewComponent,
    CairoDatePipe,
  ],
  templateUrl: './motorcycle-zone.component.html',
  styleUrl: './motorcycle-zone.component.scss',
})
export class MotorcycleZoneComponent {
  private readonly api = inject(MotorcyclesApi);
  private readonly router = inject(Router);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly ngZone = inject(NgZone);

  readonly id = input.required<string>();

  protected readonly R = APP_ROUTES;
  protected readonly MIN = MIN_RADIUS_M;
  protected readonly MAX = MAX_RADIUS_M;
  protected readonly SLIDER_STEPS = SLIDER_STEPS;
  protected readonly presets = RADIUS_PRESETS;
  protected readonly formatMeters = formatMeters;

  protected readonly zoneRes = createResource(
    () => this.id(),
    (id) => this.api.zone(id),
  );
  protected readonly overviewRes = createResource(
    () => this.id(),
    (id) => this.api.overview(id),
  );

  protected readonly backLink = computed(() => APP_ROUTES.motorcycle(this.id()));
  protected readonly plate = computed(() => this.overviewRes.value()?.motorcycle.plateNumber ?? '');
  protected readonly existing = computed<MotorcycleZoneDto | null>(
    () => this.zoneRes.value() ?? null,
  );
  protected readonly bike = computed(() => {
    const l = this.overviewRes.value()?.location;
    if (!l || l.latitude == null || l.longitude == null) return null;
    if (l.latitude === 0 && l.longitude === 0) return null;
    return {
      lat: l.latitude,
      lng: l.longitude,
      course: l.course ?? null,
      stale: !!l.isStale,
      at: l.lastGpsAtUtc ?? l.recordedAtUtc ?? null,
    };
  });

  // ── editable state ──
  protected readonly center = signal<[number, number] | null>(null);
  protected readonly radius = signal(DEFAULT_RADIUS_M);
  protected readonly name = signal('');
  protected readonly isActive = signal(true);
  protected readonly dirty = signal(false);
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  private initialized = false;

  protected readonly sliderValue = computed(() => toSlider(this.radius()));
  protected readonly bikeDistance = computed(() => {
    const c = this.center();
    const b = this.bike();
    return c && b ? distanceMeters(c, [b.lat, b.lng]) : null;
  });
  protected readonly bikeOutside = computed(() => {
    const d = this.bikeDistance();
    return d != null && d > this.radius();
  });
  protected readonly canSave = computed(
    () => !!this.center() && !this.saving() && !this.deleting(),
  );

  // ── map ──
  private readonly mapReady = signal(false);
  private map: Leaflet.Map | null = null;
  private leaflet: L | null = null;
  private circle: Leaflet.Circle | null = null;
  private centerMarker: Leaflet.Marker | null = null;
  private handle: Leaflet.Marker | null = null;
  private bikeMarker: Leaflet.Marker | null = null;
  /** Direction of the radius handle from the center — kept where the user leaves it. */
  private handleBearing = 90;
  private dragging: 'center' | 'handle' | null = null;
  private fittedOnce = false;

  constructor() {
    // Seed the form once: the saved zone, else a circle around the bike.
    effect(() => {
      const loaded = this.zoneRes.value() !== undefined;
      const zone = this.existing();
      const bike = this.bike();
      const overviewDone = this.overviewRes.value() !== undefined || !!this.overviewRes.error();
      if (!loaded || this.initialized) return;
      if (!zone && !overviewDone) return;
      untracked(() => {
        this.initialized = true;
        if (zone) {
          this.center.set([zone.centerLatitude, zone.centerLongitude]);
          this.radius.set(clampRadius(zone.radiusMeters));
          this.name.set(zone.name ?? '');
          this.isActive.set(zone.isActive !== false);
        } else if (bike) {
          this.center.set([bike.lat, bike.lng]);
          this.dirty.set(true);
        }
      });
    });

    // State → layers.
    effect(() => {
      const c = this.center();
      const r = this.radius();
      const active = this.isActive();
      if (!this.mapReady()) return;
      untracked(() => this.ngZone.runOutsideAngular(() => this.syncCircle(c, r, active)));
    });
    effect(() => {
      const b = this.bike();
      if (!this.mapReady()) return;
      untracked(() => this.ngZone.runOutsideAngular(() => this.syncBike(b)));
    });

    inject(DestroyRef).onDestroy(() => (this.map = null));
  }

  // ─────────────── form ───────────────

  protected setName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
    this.dirty.set(true);
  }

  protected setActive(event: Event): void {
    this.isActive.set((event.target as HTMLInputElement).checked);
    this.dirty.set(true);
  }

  protected onSlider(event: Event): void {
    this.radius.set(fromSlider(Number((event.target as HTMLInputElement).value)));
    this.dirty.set(true);
  }

  protected onRadiusInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    const v = Number(el.value);
    if (!Number.isFinite(v) || v <= 0) {
      el.value = String(this.radius());
      return;
    }
    const clamped = clampRadius(v);
    el.value = String(clamped);
    this.radius.set(clamped);
    this.dirty.set(true);
    this.fit();
  }

  protected setRadius(m: number): void {
    this.radius.set(clampRadius(m));
    this.dirty.set(true);
    this.fit();
  }

  protected centerOnBike(): void {
    const b = this.bike();
    if (!b) return;
    this.center.set([b.lat, b.lng]);
    this.dirty.set(true);
    this.fit();
  }

  protected fit(): void {
    this.ngZone.runOutsideAngular(() => {
      const map = this.map;
      if (!map || !this.circle) return;
      // Next frame: the circle may have just been resized by the effect.
      requestAnimationFrame(() => {
        if (this.circle && this.map) {
          this.map.fitBounds(this.circle.getBounds().pad(0.15), { animate: true });
        }
      });
    });
  }

  protected save(): void {
    const c = this.center();
    if (!c) return;
    this.serverError.set(null);
    this.saving.set(true);
    this.api
      .saveZone(this.id(), {
        name: this.name().trim() || null,
        centerLatitude: round6(c[0]),
        centerLongitude: round6(c[1]),
        radiusMeters: this.radius(),
        isActive: this.isActive(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.dirty.set(false);
          this.toast.success('تم حفظ النطاق');
          void this.router.navigateByUrl(APP_ROUTES.motorcycle(this.id()) as string);
        },
        error: (err: ApiError) => {
          this.saving.set(false);
          const field = Object.values(err.fieldErrors ?? {})[0];
          const msg = Array.isArray(field) ? field[0] : field;
          if (err.status === 400 && msg) this.serverError.set(msg);
          else this.toast.error(err.message);
        },
      });
  }

  protected async remove(): Promise<void> {
    if (!this.existing()) return;
    const ok = await this.dialog.confirm({
      title: 'حذف النطاق؟',
      message:
        `سيُحذف نطاق الموتوسيكل ${this.plate()} ولن تصدر تنبيهات خروج من النطاق له بعد الآن، ` +
        'حتى يُحدَّد نطاق جديد.',
      type: 'danger',
      confirmText: 'حذف النطاق',
    });
    if (!ok) return;
    this.deleting.set(true);
    this.api.deleteZone(this.id()).subscribe({
      next: () => {
        this.deleting.set(false);
        this.dirty.set(false);
        this.toast.success('تم حذف النطاق');
        void this.router.navigateByUrl(APP_ROUTES.motorcycle(this.id()) as string);
      },
      error: () => this.deleting.set(false),
    });
  }

  protected async cancel(): Promise<void> {
    if (this.dirty()) {
      const ok = await this.dialog.confirm({
        title: 'تجاهل التغييرات؟',
        message: 'لم تُحفظ التغييرات على النطاق.',
        type: 'warning',
        confirmText: 'تجاهل',
      });
      if (!ok) return;
    }
    void this.router.navigateByUrl(APP_ROUTES.motorcycle(this.id()) as string);
  }

  // ─────────────── map ───────────────

  protected onMap({ map, L: leaflet }: MapReadyEvent): void {
    this.map = map;
    this.leaflet = leaflet;
    this.ngZone.runOutsideAngular(() => {
      map.getContainer().style.cursor = 'crosshair';
      map.on('click', (e: Leaflet.LeafletMouseEvent) =>
        this.ngZone.run(() => {
          this.center.set([e.latlng.lat, e.latlng.lng]);
          this.dirty.set(true);
        }),
      );
    });
    this.mapReady.set(true);
  }

  private syncCircle(c: [number, number] | null, r: number, active: boolean): void {
    const leaflet = this.leaflet;
    const map = this.map;
    if (!leaflet || !map) return;
    if (!c) {
      this.circle?.remove();
      this.centerMarker?.remove();
      this.handle?.remove();
      this.circle = this.centerMarker = this.handle = null;
      return;
    }
    const color = cssVar('--primary', '#0d9488');
    const handlePos = destinationPoint(c, r, this.handleBearing);

    if (!this.circle) {
      this.circle = leaflet
        .circle(c, { radius: r, color, weight: 2, fillOpacity: 0.1, interactive: false })
        .addTo(map);
      this.centerMarker = leaflet
        .marker(c, {
          draggable: true,
          autoPan: true,
          title: 'مركز النطاق — اسحب لتحريكه',
          icon: leaflet.divIcon({
            html: '<div class="dot-marker" style="width:1.375rem;height:1.375rem;cursor:move"></div>',
            className: 'fleet-marker',
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
        })
        .addTo(map);
      this.handle = leaflet
        .marker(handlePos, {
          draggable: true,
          autoPan: true,
          title: 'اسحب لتغيير نصف القطر',
          icon: leaflet.divIcon({
            html: '<div class="dot-marker" style="background:#fff;border-color:var(--primary);cursor:ew-resize"></div>',
            className: 'fleet-marker',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
        })
        .addTo(map);
      this.wireDrag();
    } else {
      this.circle.setLatLng(c).setRadius(r);
      if (this.dragging !== 'center') this.centerMarker?.setLatLng(c);
      if (this.dragging !== 'handle') this.handle?.setLatLng(handlePos);
    }
    this.circle.setStyle({ color, dashArray: active ? undefined : '6 6' });

    if (!this.fittedOnce) {
      this.fittedOnce = true;
      map.fitBounds(this.circle.getBounds().pad(0.15), { animate: false });
    }
  }

  private wireDrag(): void {
    const center = this.centerMarker;
    const handle = this.handle;
    if (!center || !handle) return;

    center.on('dragstart', () => (this.dragging = 'center'));
    center.on('drag', () => {
      const p = center.getLatLng();
      const c: [number, number] = [p.lat, p.lng];
      // Move circle + handle live without a CD round-trip per mouse move.
      this.circle?.setLatLng(c);
      handle.setLatLng(destinationPoint(c, this.radius(), this.handleBearing));
    });
    center.on('dragend', () => {
      const p = center.getLatLng();
      this.dragging = null;
      this.ngZone.run(() => {
        this.center.set([p.lat, p.lng]);
        this.dirty.set(true);
      });
    });

    handle.on('dragstart', () => (this.dragging = 'handle'));
    handle.on('drag', () => {
      const c = this.center();
      if (!c) return;
      const p = handle.getLatLng();
      this.handleBearing = bearingDeg(c, [p.lat, p.lng]);
      const r = clampRadius(distanceMeters(c, [p.lat, p.lng]));
      this.circle?.setRadius(r);
      this.ngZone.run(() => this.radius.set(r));
    });
    handle.on('dragend', () => {
      this.dragging = null;
      const c = this.center();
      // Snap the handle back onto the (clamped) edge.
      if (c) handle.setLatLng(destinationPoint(c, this.radius(), this.handleBearing));
      this.ngZone.run(() => this.dirty.set(true));
    });
  }

  private syncBike(
    b: { lat: number; lng: number; course: number | null; stale: boolean } | null,
  ): void {
    const leaflet = this.leaflet;
    const map = this.map;
    if (!leaflet || !map) return;
    if (!b) {
      this.bikeMarker?.remove();
      this.bikeMarker = null;
      return;
    }
    if (!this.bikeMarker) {
      this.bikeMarker = leaflet
        .marker([b.lat, b.lng], {
          icon: leaflet.divIcon({
            html: bikeMarkerHtml({ course: b.course, stale: b.stale }),
            className: 'fleet-marker',
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          }),
          interactive: false,
          keyboard: false,
          zIndexOffset: -100,
        })
        .addTo(map);
      // No zone yet and nothing to fit to: start around the bike.
      if (!this.circle) map.setView([b.lat, b.lng], 14, { animate: false });
    } else {
      this.bikeMarker.setLatLng([b.lat, b.lng]);
    }
  }
}

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;
