import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import { ThemeService } from '@core/services/theme.service';
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  L,
  TILE_ATTRIBUTION,
  loadLeaflet,
  tileUrl,
} from './leaflet-loader';

export interface MapReadyEvent {
  map: Leaflet.Map;
  L: L;
}

/**
 * Thin Leaflet host: creates the map, keeps tiles in sync with the theme,
 * resizes with its container and cleans up. Screens add their own layers in
 * `(ready)`:
 *
 *   <app-map-view [center]="[lat, lng]" [zoom]="14" (ready)="onMap($event)" />
 *
 * Leaflet runs outside Angular's zone (pan/zoom fire hundreds of events);
 * re-enter with `zone.run()` only when a map event must update the UI.
 * The container is LTR on purpose — Leaflet's controls assume it — while
 * tooltip/popup content stays RTL via CSS.
 */
@Component({
  selector: 'app-map-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #host class="mv" dir="ltr"></div>
    @if (!loaded()) {
      <div class="mv__loading skeleton" aria-hidden="true"></div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      min-height: 12rem;
      overflow: hidden;
      border-radius: var(--rl);
      isolation: isolate;
    }
    .mv {
      position: absolute;
      inset: 0;
    }
    .mv__loading {
      position: absolute;
      inset: 0;
      border-radius: 0;
    }
  `,
})
export class MapViewComponent {
  readonly center = input<[number, number] | null>(null);
  readonly zoom = input<number>(DEFAULT_ZOOM);
  /** Scroll-wheel zoom is off on small embedded maps so the page still scrolls. */
  readonly scrollZoom = input(true);
  readonly ready = output<MapReadyEvent>();

  protected readonly loaded = signal(false);

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly theme = inject(ThemeService);
  private readonly zone = inject(NgZone);
  private map: Leaflet.Map | null = null;
  private tiles: Leaflet.TileLayer | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private destroyed = false;

  constructor() {
    void this.init();

    effect(() => {
      const theme = this.theme.theme();
      this.tiles?.setUrl(tileUrl(theme));
    });

    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.resizeObserver?.disconnect();
      this.map?.remove();
      this.map = null;
    });
  }

  private async init(): Promise<void> {
    const leaflet = await loadLeaflet();
    if (this.destroyed) return;

    this.zone.runOutsideAngular(() => {
      const map = leaflet.map(this.host().nativeElement, {
        center: this.center() ?? DEFAULT_CENTER,
        zoom: this.zoom(),
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: this.scrollZoom(),
      });
      map.attributionControl.setPrefix(false);

      this.tiles = leaflet
        .tileLayer(tileUrl(this.theme.theme()), {
          attribution: TILE_ATTRIBUTION,
          subdomains: 'abcd',
          maxZoom: 19,
          detectRetina: true,
        })
        .addTo(map);

      this.resizeObserver = new ResizeObserver(() => map.invalidateSize());
      this.resizeObserver.observe(this.host().nativeElement);
      this.map = map;
    });

    this.loaded.set(true);
    this.ready.emit({ map: this.map!, L: leaflet });
  }
}
