import type * as Leaflet from 'leaflet';

export type L = typeof Leaflet;

let pending: Promise<L> | null = null;

/**
 * Leaflet is ~150 KB, so it's loaded on first use (map screens only) and
 * cached. Every map component goes through this — never `import 'leaflet'`
 * eagerly, or it lands in the main bundle.
 */
export function loadLeaflet(): Promise<L> {
  pending ??= import('leaflet').then((m) => (m as unknown as { default?: L }).default ?? (m as L));
  return pending;
}

/** Cairo — fallback center when nothing better is known. */
export const DEFAULT_CENTER: [number, number] = [30.0444, 31.2357];
export const DEFAULT_ZOOM = 11;

/** CARTO basemaps: clean, label-light tiles that match both themes. */
export function tileUrl(theme: 'light' | 'dark'): string {
  const style = theme === 'dark' ? 'dark_all' : 'light_all';
  return `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`;
}

export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Escapes text before it goes into Leaflet HTML (tooltips, div icons). */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
