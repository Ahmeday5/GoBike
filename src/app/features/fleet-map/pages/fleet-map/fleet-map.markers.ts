import {
  EnumMeta,
  GPS_CONNECTIVITY,
  MOTORCYCLE_HEALTH,
  MOTORCYCLE_STATUS,
  enumMeta,
} from '@core/constants/enums';
import { FleetMapItem } from '@core/realtime/realtime.models';
import { formatRelative } from '@core/utils/cairo-time.util';
import { formatKm, formatNumber } from '@core/utils/format.util';
import { escapeHtml } from '@shared/map/leaflet-loader';
import { isOffline } from '../../models/fleet-map.models';

/*
 * HTML for Leaflet's div icons and hover cards. Leaflet renders it outside
 * Angular, so every piece of data goes through escapeHtml(); the classes are
 * the global ones from styles/_map.scss and _patterns.scss.
 */

const ARROW_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5 4.6 20.2c-.2.5.3 1 .8.7L12 17.6l6.6 3.3c.5.3 1-.2.8-.7z"/></svg>';
const DOT_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="5"/></svg>';

/** Marker look minus heading — the icon is only rebuilt when this changes. */
export function markerKey(m: FleetMapItem): string {
  return [m.health, isOffline(m), badgeText(m), m.course == null].join('|');
}

function badgeText(m: FleetMapItem): string {
  if (m.openIncidents > 0) return m.openIncidents > 9 ? '9+' : String(m.openIncidents);
  return m.isOutOfZone ? '!' : '';
}

export function markerHtml(m: FleetMapItem): string {
  const classes = ['moto-marker'];
  if (m.health === 'Red') classes.push('moto-marker--red');
  if (isOffline(m)) classes.push('moto-marker--stale');
  const badge = badgeText(m);
  const heading = m.course == null ? DOT_SVG : ARROW_SVG;
  return (
    `<div class="${classes.join(' ')}">` +
    `<span class="moto-marker__arrow" style="transform: rotate(${Math.round(m.course ?? 0)}deg)">${heading}</span>` +
    (badge ? `<span class="moto-marker__badge">${escapeHtml(badge)}</span>` : '') +
    `</div>`
  );
}

function chip(meta: EnumMeta): string {
  return `<span class="chip chip--${meta.tone} chip--sm"><span class="chip__text">${escapeHtml(meta.label)}</span></span>`;
}

function row(label: string, value: string, valueClass?: string): string {
  const cls = valueClass ? ` class="${valueClass}"` : '';
  return `<div><dt>${escapeHtml(label)}</dt><dd${cls}>${value}</dd></div>`;
}

const ltr = (v: unknown) => `<span class="ltr">${escapeHtml(v)}</span>`;

/** Hover card — evaluated each time the tooltip opens, so "X ago" stays fresh. */
export function cardHtml(m: FleetMapItem): string {
  const model = [m.brand, m.model].filter(Boolean).join(' ');
  const chips = [chip(enumMeta(MOTORCYCLE_STATUS, m.status)), chip(enumMeta(MOTORCYCLE_HEALTH, m.health))];
  if (m.isOutOfZone) chips.push(chip({ label: 'خارج النطاق', tone: 'danger' }));
  if (m.openIncidents > 0) {
    chips.push(chip({ label: `حوادث مفتوحة: ${m.openIncidents}`, tone: 'warning' }));
  }
  if (m.connectivity === 'Offline') chips.push(chip(enumMeta(GPS_CONNECTIVITY, m.connectivity)));

  const driver = m.driverName
    ? `${escapeHtml(m.driverName)}${m.driverPhone ? `<br>${ltr(m.driverPhone)}` : ''}`
    : '<span class="muted">بدون سائق</span>';
  const lastSeen = m.lastGpsAtUtc ? escapeHtml(formatRelative(m.lastGpsAtUtc)) : '—';
  const speed = m.speedKmh == null ? '—' : `${ltr(formatNumber(m.speedKmh))} كم/س`;

  return (
    `<div class="map-card">` +
    `<div class="map-card__head"><span class="map-card__plate ltr">${escapeHtml(m.plateNumber)}</span>` +
    (m.internalCode ? `<span class="muted">${escapeHtml(m.internalCode)}</span>` : '') +
    `</div>` +
    `<div class="map-card__model">${escapeHtml(model || '—')}${m.officeName ? ` · ${escapeHtml(m.officeName)}` : ''}</div>` +
    `<div class="map-card__chips">${chips.join('')}</div>` +
    `<dl class="map-card__rows">` +
    row('السائق', driver) +
    row('السرعة', speed) +
    row('آخر إشارة', lastSeen) +
    row(
      'منذ تغيير الزيت',
      escapeHtml(formatKm(m.kmSinceOilChange)),
      `oil-${m.oilLevel ?? 'None'}`,
    ) +
    `</dl>` +
    `<div class="map-card__hint">اضغط لفتح صفحة الموتوسيكل</div>` +
    `</div>`
  );
}
