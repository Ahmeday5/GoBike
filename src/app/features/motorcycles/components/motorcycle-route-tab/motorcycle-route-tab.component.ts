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
import type * as Leaflet from 'leaflet';
import { createResource } from '@core/data/resource';
import { injectUrlState } from '@core/routing/url-state';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { L } from '@shared/map/leaflet-loader';
import { MapReadyEvent, MapViewComponent } from '@shared/map/map-view.component';
import { CairoDatePipe, KmPipe, NumberPipe } from '@shared/pipes/format.pipes';
import { MotorcyclesApi } from '../../data-access/motorcycles.api';
import { RoutePoint } from '../../models/motorcycle-overview.models';
import {
  GpsWindowQuery,
  bearingDeg,
  bikeMarkerHtml,
  cssVar,
  defaultGpsWindow,
  distanceMeters,
  resolveGpsWindow,
} from '../../utils/gps-window';
import { GpsWindowFilterComponent } from '../gps-window-filter/gps-window-filter.component';

const PLAY_SPEEDS = [1, 4, 16] as const;
const PLAY_TICK_MS = 250;

/**
 * Motorcycle page → route tab (`GET /gps/motorcycles/{id}/route`, ≤ 48 h).
 * Polyline with start/end markers and a time slider that moves a marker
 * along the recorded points (optionally played back).
 */
@Component({
  selector: 'app-motorcycle-route-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MapViewComponent,
    EmptyStateComponent,
    IconComponent,
    CairoDatePipe,
    KmPipe,
    NumberPipe,
    GpsWindowFilterComponent,
  ],
  template: `
    <app-gps-window-filter [window]="win()" (changed)="url.patch($event)" />

    @if (route.error(); as err) {
      <div
        class="alert alert-danger d-flex justify-content-between align-items-center"
        role="alert"
      >
        <span>{{ err.message }}</span>
        <button type="button" class="btn btn-sm" (click)="route.reload()">إعادة المحاولة</button>
      </div>
    }

    <section class="panel rt" [class.rt--busy]="route.loading()">
      @if (!win().error && stats(); as s) {
        <div class="stats rt-stats">
          <div class="stat">
            <span class="stat__icon"><app-icon name="route" [size]="18" /></span>
            <span>
              <span class="stat__value">{{ s.km | km: true }}</span>
              <span class="stat__label">المسافة التقريبية</span>
            </span>
          </div>
          <div class="stat">
            <span class="stat__icon"><app-icon name="speed" [size]="18" /></span>
            <span>
              <span class="stat__value">{{ s.maxSpeed | num }} <small>كم/س</small></span>
              <span class="stat__label">أعلى سرعة</span>
            </span>
          </div>
          <div class="stat stat--neutral">
            <span class="stat__icon"><app-icon name="map-pin" [size]="18" /></span>
            <span>
              <span class="stat__value">{{ s.count | num }}</span>
              <span class="stat__label">نقطة مسجلة</span>
            </span>
          </div>
        </div>
      }

      <div class="rt-map">
        <app-map-view class="rt-map__view" (ready)="onMap($event)" />
        @if (route.initialLoading()) {
          <div class="rt-map__overlay skeleton" aria-hidden="true"></div>
        } @else if (!route.loading() && !win().error && points().length === 0) {
          <div class="rt-map__overlay rt-map__overlay--empty">
            <app-empty-state
              icon="route"
              title="لا يوجد مسار في هذه الفترة"
              text="لم يسجّل جهاز التتبع أي حركة. جرّب فترة أخرى."
            />
          </div>
        }
      </div>

      @if (points().length > 1 && !win().error) {
        <div class="rt-player">
          <button
            type="button"
            class="btn btn-sm"
            [attr.aria-label]="playing() ? 'إيقاف مؤقت' : 'تشغيل'"
            (click)="togglePlay()"
          >
            <app-icon [name]="playing() ? 'pause' : 'play'" [size]="16" />
          </button>
          <button
            type="button"
            class="btn btn-sm btn-ghost rt-player__speed"
            title="سرعة التشغيل"
            (click)="cycleSpeed()"
          >
            ×{{ speed() }}
          </button>
          <input
            type="range"
            class="form-range rt-player__slider"
            min="0"
            [max]="points().length - 1"
            step="1"
            [value]="index()"
            aria-label="موضع الموتوسيكل على المسار"
            (input)="seek($event)"
          />
          @if (current(); as p) {
            <div class="rt-player__info">
              <span><app-icon name="clock" [size]="14" />{{ p.atUtc | cairoDate }}</span>
              <span>
                <app-icon name="speed" [size]="14" />
                <span class="ltr">{{ p.speed | num }}</span> كم/س
              </span>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .rt {
      transition: opacity var(--dur-2);
    }
    .rt--busy {
      opacity: 0.75;
    }
    .rt-stats {
      margin-bottom: 0.875rem;
    }
    .rt-map {
      position: relative;
    }
    .rt-map__view {
      height: 28rem;
    }
    .rt-map__overlay {
      position: absolute;
      inset: 0;
      z-index: 500;
      border-radius: var(--rl);
    }
    .rt-map__overlay--empty {
      display: grid;
      place-items: center;
      background: color-mix(in srgb, var(--bg2) 82%, transparent);
    }
    .rt-player {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 0.75rem;
      margin-top: 0.875rem;
    }
    .rt-player__speed {
      min-width: 2.75rem;
      font-variant-numeric: tabular-nums;
    }
    .rt-player__slider {
      flex: 1;
      min-width: 12rem;
    }
    .rt-player__info {
      display: flex;
      gap: 1rem;
      font-size: var(--fs-sm);
      color: var(--txt2);
      span {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
      }
    }
    @media (max-width: 575.98px) {
      .rt-map__view {
        height: 20rem;
      }
    }
  `,
})
export class MotorcycleRouteTabComponent {
  private readonly api = inject(MotorcyclesApi);
  private readonly zone = inject(NgZone);

  readonly motorcycleId = input.required<string>();

  protected readonly url = injectUrlState<GpsWindowQuery>({ from: '', to: '' });
  private readonly fallback = defaultGpsWindow();
  protected readonly win = computed(() => resolveGpsWindow(this.url.state(), this.fallback));

  protected readonly route = createResource(
    () => {
      const w = this.win();
      return w.error || !w.fromUtc || !w.toUtc
        ? null
        : { id: this.motorcycleId(), from: w.fromUtc, to: w.toUtc };
    },
    ({ id, from, to }) => this.api.route(id, from, to),
  );
  protected readonly points = computed<RoutePoint[]>(() => this.route.value() ?? []);

  protected readonly stats = computed(() => {
    const pts = this.points();
    if (!pts.length) return null;
    let meters = 0;
    let maxSpeed = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i > 0)
        meters += distanceMeters([pts[i - 1].lat, pts[i - 1].lng], [pts[i].lat, pts[i].lng]);
      maxSpeed = Math.max(maxSpeed, pts[i].speed ?? 0);
    }
    return { km: meters / 1000, maxSpeed, count: pts.length };
  });

  protected readonly index = signal(0);
  protected readonly current = computed(() => this.points()[this.index()] ?? null);
  protected readonly playing = signal(false);
  protected readonly speed = signal<(typeof PLAY_SPEEDS)[number]>(1);
  private timer: ReturnType<typeof setInterval> | null = null;

  private readonly mapReady = signal(false);
  private map: Leaflet.Map | null = null;
  private leaflet: L | null = null;
  private trackLayer: Leaflet.LayerGroup | null = null;
  private cursor: Leaflet.Marker | null = null;

  constructor() {
    // New data → rewind and redraw the track.
    effect(() => {
      const pts = this.points();
      if (!this.mapReady()) return;
      untracked(() => {
        this.stop();
        this.index.set(0);
        this.zone.runOutsideAngular(() => this.drawTrack(pts));
      });
    });

    // Slider position → cursor marker.
    effect(() => {
      const i = this.index();
      const pts = this.points();
      if (!this.mapReady()) return;
      untracked(() => this.zone.runOutsideAngular(() => this.moveCursor(pts, i)));
    });

    inject(DestroyRef).onDestroy(() => {
      this.stop();
      this.map = null;
    });
  }

  protected onMap({ map, L: leaflet }: MapReadyEvent): void {
    this.map = map;
    this.leaflet = leaflet;
    this.zone.runOutsideAngular(() => (this.trackLayer = leaflet.layerGroup().addTo(map)));
    this.mapReady.set(true);
  }

  protected seek(event: Event): void {
    this.index.set(Number((event.target as HTMLInputElement).value) || 0);
  }

  protected togglePlay(): void {
    if (this.playing()) {
      this.stop();
      return;
    }
    if (this.index() >= this.points().length - 1) this.index.set(0);
    this.playing.set(true);
    this.timer = setInterval(() => {
      const last = this.points().length - 1;
      const next = Math.min(last, this.index() + this.speed());
      this.index.set(next);
      if (next >= last) this.stop();
    }, PLAY_TICK_MS);
  }

  protected cycleSpeed(): void {
    const i = PLAY_SPEEDS.indexOf(this.speed());
    this.speed.set(PLAY_SPEEDS[(i + 1) % PLAY_SPEEDS.length]);
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.playing.set(false);
  }

  private drawTrack(pts: RoutePoint[]): void {
    const leaflet = this.leaflet;
    const layer = this.trackLayer;
    const map = this.map;
    if (!leaflet || !layer || !map) return;
    layer.clearLayers();
    this.cursor = null;
    if (!pts.length) return;

    const latlngs = pts.map((p) => [p.lat, p.lng] as [number, number]);
    const line = leaflet
      .polyline(latlngs, {
        color: cssVar('--primary', '#0d9488'),
        weight: 4,
        opacity: 0.85,
        lineJoin: 'round',
      })
      .addTo(layer);

    const dot = (cls: string, title: string, at: [number, number]) =>
      leaflet
        .marker(at, {
          icon: leaflet.divIcon({
            html: `<div class="dot-marker ${cls}"></div>`,
            className: 'fleet-marker',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
          title,
          keyboard: false,
        })
        .bindTooltip(title, { className: 'map-tooltip', direction: 'top' })
        .addTo(layer);
    dot('dot-marker--start', 'البداية', latlngs[0]);
    if (latlngs.length > 1) dot('dot-marker--end', 'النهاية', latlngs[latlngs.length - 1]);

    this.cursor = leaflet
      .marker(latlngs[0], {
        icon: leaflet.divIcon({
          html: bikeMarkerHtml({ course: headingAt(pts, 0) }),
          className: 'fleet-marker',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        }),
        zIndexOffset: 1000,
        keyboard: false,
      })
      .addTo(layer);

    if (latlngs.length > 1) map.fitBounds(line.getBounds().pad(0.1), { maxZoom: 17 });
    else map.setView(latlngs[0], 16);
  }

  private moveCursor(pts: RoutePoint[], i: number): void {
    const p = pts[i];
    if (!p || !this.cursor) return;
    this.cursor.setLatLng([p.lat, p.lng]);
    const arrow = this.cursor.getElement()?.querySelector<HTMLElement>('.moto-marker__arrow');
    if (arrow) arrow.style.transform = `rotate(${Math.round(headingAt(pts, i) ?? 0)}deg)`;
    if (this.playing() && this.map && !this.map.getBounds().contains([p.lat, p.lng])) {
      this.map.panTo([p.lat, p.lng], { animate: true });
    }
  }
}

/** Reported course, or the bearing toward the next point when the tracker didn't send one. */
function headingAt(pts: RoutePoint[], i: number): number | null {
  const p = pts[i];
  if (!p) return null;
  if (p.course != null) return p.course;
  const next = pts[i + 1] ?? null;
  const prev = pts[i - 1] ?? null;
  if (next) return bearingDeg([p.lat, p.lng], [next.lat, next.lng]);
  if (prev) return bearingDeg([prev.lat, prev.lng], [p.lat, p.lng]);
  return null;
}
