import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import { L } from '@shared/map/leaflet-loader';
import { MapReadyEvent, MapViewComponent } from '@shared/map/map-view.component';
import { MotorcycleZoneDto } from '../../models/motorcycle-overview.models';
import { bikeMarkerHtml, cssVar } from '../../utils/gps-window';

export interface MiniMapPosition {
  lat: number;
  lng: number;
  course?: number | null;
  red?: boolean;
  stale?: boolean;
  label?: string;
}

/**
 * Small embedded map for the motorcycle page: the bike (rotated by heading)
 * and its zone circle. Re-renders layers when inputs change, refits only
 * when the bike or zone first appears.
 */
@Component({
  selector: 'app-motorcycle-mini-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MapViewComponent],
  template: `<app-map-view class="mm" [scrollZoom]="false" [zoom]="14" (ready)="onMap($event)" />`,
  styles: `
    :host {
      display: block;
    }
    .mm {
      height: 20rem;
    }
    @media (max-width: 575.98px) {
      .mm {
        height: 15rem;
      }
    }
  `,
})
export class MotorcycleMiniMapComponent {
  private readonly zone = inject(NgZone);

  readonly position = input<MiniMapPosition | null>(null);
  readonly zoneCircle = input<MotorcycleZoneDto | null>(null);

  private readonly ready = signal(false);
  private map: Leaflet.Map | null = null;
  private leaflet: L | null = null;
  private layer: Leaflet.LayerGroup | null = null;
  private fittedKey = '';

  constructor() {
    effect(() => {
      const pos = this.position();
      const circle = this.zoneCircle();
      if (!this.ready()) return;
      untracked(() => this.zone.runOutsideAngular(() => this.draw(pos, circle)));
    });
    inject(DestroyRef).onDestroy(() => (this.map = null));
  }

  protected onMap({ map, L: leaflet }: MapReadyEvent): void {
    this.map = map;
    this.leaflet = leaflet;
    this.zone.runOutsideAngular(() => (this.layer = leaflet.layerGroup().addTo(map)));
    this.ready.set(true);
  }

  private draw(pos: MiniMapPosition | null, circle: MotorcycleZoneDto | null): void {
    const leaflet = this.leaflet;
    const layer = this.layer;
    const map = this.map;
    if (!leaflet || !layer || !map) return;
    layer.clearLayers();

    let bounds: Leaflet.LatLngBounds | null = null;
    if (circle) {
      const c = leaflet
        .circle([circle.centerLatitude, circle.centerLongitude], {
          radius: circle.radiusMeters,
          color: circle.isOutside ? cssVar('--re', '#dc2626') : cssVar('--primary', '#0d9488'),
          weight: 2,
          fillOpacity: 0.08,
          dashArray: circle.isActive === false ? '6 6' : undefined,
        })
        .addTo(layer);
      if (circle.name) c.bindTooltip(circle.name, { className: 'map-tooltip', direction: 'top' });
      bounds = c.getBounds();
    }
    if (pos) {
      leaflet
        .marker([pos.lat, pos.lng], {
          icon: leaflet.divIcon({
            html: bikeMarkerHtml({ course: pos.course, red: pos.red, stale: pos.stale }),
            className: 'fleet-marker',
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          }),
          title: pos.label,
          keyboard: false,
        })
        .addTo(layer);
      bounds = bounds ? bounds.extend([pos.lat, pos.lng]) : null;
    }

    const key = `${pos ? 'p' : ''}|${circle ? `${circle.centerLatitude},${circle.centerLongitude},${circle.radiusMeters}` : ''}`;
    if (key === this.fittedKey) return;
    this.fittedKey = key;
    if (bounds) map.fitBounds(bounds.pad(0.1), { maxZoom: 16, animate: false });
    else if (pos) map.setView([pos.lat, pos.lng], 15, { animate: false });
  }
}
