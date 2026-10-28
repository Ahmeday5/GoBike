/** Number formatting shared by pipes and imperative code (map popups, charts). */

const LOCALE = 'ar-EG-u-nu-latn';

const MONEY = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'EGP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const INTEGER = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const DECIMAL = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** EGP with 2 decimals — the API's money contract. */
export function formatMoney(value: number | null | undefined): string {
  return isNum(value) ? MONEY.format(value) : '—';
}

/** Distance in km (fields named `…Km`). */
export function formatKm(value: number | null | undefined, decimals = false): string {
  return isNum(value) ? `${(decimals ? DECIMAL : INTEGER).format(value)} كم` : '—';
}

export function formatNumber(value: number | null | undefined, decimals = false): string {
  return isNum(value) ? (decimals ? DECIMAL : INTEGER).format(value) : '—';
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!isNum(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${DECIMAL.format(bytes / 1024)} KB`;
  return `${DECIMAL.format(bytes / 1024 ** 2)} MB`;
}
