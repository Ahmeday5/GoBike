import { environment } from '@env/environment';

/**
 * Time handling contract (see the API brief):
 *   - the API sends and expects UTC ISO-8601 (`…Utc` fields), `DateOnly` as `yyyy-MM-dd`
 *   - the UI always displays Africa/Cairo wall time, whatever the viewer's OS clock is
 *
 * Every conversion between the two lives here. Intl does the timezone math, so
 * daylight-saving changes in Egypt are handled without a date library.
 */

const TZ = environment.timeZone;
/** Arabic text, Latin digits — easier to scan in dense tables. */
const LOCALE = 'ar-EG-u-nu-latn';

const FORMATS = {
  date: new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }),
  datetime: new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }),
  time: new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, hour: 'numeric', minute: '2-digit' }),
  /** Numeric parts used for conversions (24h, en digits). */
  parts: new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }),
} as const;

const RELATIVE = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

export type DateFormat = 'date' | 'datetime' | 'time' | 'relative';

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** UTC ISO (or DateOnly) → Cairo display string. Returns '—' for empty/invalid input. */
export function formatCairo(
  value: string | Date | null | undefined,
  format: DateFormat = 'datetime',
): string {
  // A bare DateOnly has no time or zone — format it as the calendar date it names.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Intl.DateTimeFormat(LOCALE, {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(Date.UTC(y, m - 1, d)));
  }
  const date = toDate(value);
  if (!date) return '—';
  return format === 'relative' ? formatRelative(date) : FORMATS[format].format(date);
}

/** "منذ 5 دقائق" / "بعد ساعتين". */
export function formatRelative(value: string | Date, now = Date.now()): string {
  const date = toDate(value);
  if (!date) return '—';
  const seconds = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'الآن';
  if (abs < 3600) return RELATIVE.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return RELATIVE.format(Math.round(seconds / 3600), 'hour');
  if (abs < 2_592_000) return RELATIVE.format(Math.round(seconds / 86_400), 'day');
  return FORMATS.date.format(date);
}

interface WallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function cairoParts(date: Date): WallParts {
  const map: Record<string, number> = {};
  for (const p of FORMATS.parts.formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = Number(p.value);
  }
  return map as unknown as WallParts;
}

/** Cairo's offset from UTC (ms) at a given instant — DST-aware. */
function cairoOffsetMs(instant: number): number {
  const p = cairoParts(new Date(instant));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * `<input type="datetime-local">` value (Cairo wall time) → UTC ISO for the API.
 * Two passes settle the offset correctly even across a DST switch.
 */
export function cairoInputToUtc(local: string | null | undefined): string | null {
  const m = local?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let utc = wall - cairoOffsetMs(wall);
  utc = wall - cairoOffsetMs(utc);
  return new Date(utc).toISOString();
}

/** UTC ISO → `<input type="datetime-local">` value in Cairo wall time. */
export function utcToCairoInput(iso: string | Date | null | undefined): string {
  const date = toDate(iso);
  if (!date) return '';
  const p = cairoParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Today's calendar date in Cairo as `yyyy-MM-dd` (for DateOnly params). */
export function cairoToday(offsetDays = 0): string {
  const p = cairoParts(new Date(Date.now() + offsetDays * 86_400_000));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Now, as a datetime-local value in Cairo — default for "happened at" inputs. */
export function cairoNowInput(): string {
  return utcToCairoInput(new Date());
}

/** UTC ISO of `hours` ago — for "last N hours" API windows. */
export function utcHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}
