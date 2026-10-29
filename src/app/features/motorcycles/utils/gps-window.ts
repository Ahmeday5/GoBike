import { cairoInputToUtc, utcHoursAgo, utcToCairoInput } from '@core/utils/cairo-time.util';

/** The GPS history endpoints accept at most 48 hours per request. */
export const MAX_GPS_WINDOW_HOURS = 48;
export const DEFAULT_GPS_WINDOW_HOURS = 24;

/**
 * URL-backed GPS window shared by the route and alarms tabs (`?from=&to=`,
 * Cairo `datetime-local` values). Empty = "last 24 hours" at page load.
 */
export type GpsWindowQuery = { from: string; to: string };

export interface GpsWindow {
  /** Cairo datetime-local values as shown in the inputs. */
  fromInput: string;
  toInput: string;
  fromUtc: string | null;
  toUtc: string | null;
  /** Arabic validation message, or null when the window can be sent. */
  error: string | null;
}

/** Default "last 24 h" inputs, computed once per screen so it doesn't drift. */
export function defaultGpsWindow(): { from: string; to: string } {
  return {
    from: utcToCairoInput(utcHoursAgo(DEFAULT_GPS_WINDOW_HOURS)),
    to: utcToCairoInput(new Date()),
  };
}

export function resolveGpsWindow(
  q: GpsWindowQuery,
  fallback: { from: string; to: string },
): GpsWindow {
  const fromInput = q.from || fallback.from;
  const toInput = q.to || fallback.to;
  const fromUtc = cairoInputToUtc(fromInput);
  const toUtc = cairoInputToUtc(toInput);
  let error: string | null = null;
  if (!fromUtc || !toUtc) {
    error = 'حدّد بداية ونهاية الفترة.';
  } else {
    const hours = (Date.parse(toUtc) - Date.parse(fromUtc)) / 3_600_000;
    if (hours <= 0) error = 'يجب أن تكون نهاية الفترة بعد بدايتها.';
    else if (hours > MAX_GPS_WINDOW_HOURS)
      error = `أقصى مدة مسموح بها ${MAX_GPS_WINDOW_HOURS} ساعة — قلّل الفترة.`;
  }
  return { fromInput, toInput, fromUtc, toUtc, error };
}

/** Great-circle distance in meters. */
export function distanceMeters(a: [number, number], b: [number, number]): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point `meters` away from `from` along `bearingDeg` (0 = north, 90 = east). */
export function destinationPoint(
  from: [number, number],
  meters: number,
  bearingDeg: number,
): [number, number] {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const δ = meters / R;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(from[0]);
  const λ1 = toRad(from[1]);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 +
    Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return [toDeg(φ2), ((toDeg(λ2) + 540) % 360) - 180];
}

/** Bearing in degrees from `a` to `b`. */
export function bearingDeg(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(a[0]);
  const φ2 = toRad(b[0]);
  const Δλ = toRad(b[1] - a[1]);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** "850 م" / "12.5 كم". */
export function formatMeters(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(m)) return '—';
  if (m < 1000) return `${Math.round(m)} م`;
  const km = m / 1000;
  return `${km >= 100 ? Math.round(km) : Math.round(km * 10) / 10} كم`;
}

/**
 * Resolves a theme token for Leaflet vector layers (SVG presentation
 * attributes can't read `var(--x)`).
 */
export function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Same arrow as the live map's markers (styles/_map.scss `.moto-marker`). */
export const ARROW_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5 4.6 20.2c-.2.5.3 1 .8.7L12 17.6l6.6 3.3c.5.3 1-.2.8-.7z"/></svg>';
export const DOT_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="5"/></svg>';

/** Marker HTML for one bike (L.divIcon), rotated by its heading. */
export function bikeMarkerHtml(opts: {
  course: number | null | undefined;
  red?: boolean;
  stale?: boolean;
}): string {
  const classes = ['moto-marker'];
  if (opts.red) classes.push('moto-marker--red');
  if (opts.stale) classes.push('moto-marker--stale');
  const icon = opts.course == null ? DOT_SVG : ARROW_SVG;
  return (
    `<div class="${classes.join(' ')}">` +
    `<span class="moto-marker__arrow" style="transform: rotate(${Math.round(opts.course ?? 0)}deg)">${icon}</span>` +
    `</div>`
  );
}
