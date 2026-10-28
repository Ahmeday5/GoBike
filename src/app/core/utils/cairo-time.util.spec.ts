import { cairoInputToUtc, formatCairo, utcToCairoInput } from './cairo-time.util';

/**
 * Egypt observes DST (UTC+3 in summer, UTC+2 in winter). These tests pin
 * instants on both sides so the conversions stay right whatever the test
 * machine's own timezone is.
 */
describe('cairo-time.util', () => {
  it('converts a Cairo winter wall time to UTC (UTC+2)', () => {
    expect(cairoInputToUtc('2026-01-15T10:30')).toBe('2026-01-15T08:30:00.000Z');
  });

  it('converts a Cairo summer wall time to UTC (UTC+3)', () => {
    expect(cairoInputToUtc('2026-07-15T10:30')).toBe('2026-07-15T07:30:00.000Z');
  });

  it('round-trips UTC → Cairo input → UTC', () => {
    const utc = '2026-03-10T21:05:00.000Z';
    expect(cairoInputToUtc(utcToCairoInput(utc))).toBe(utc);
  });

  it('shows UTC instants in Cairo wall time', () => {
    expect(utcToCairoInput('2026-07-15T22:00:00Z')).toBe('2026-07-16T01:00');
  });

  it('formats a DateOnly as the calendar day it names (no timezone shift)', () => {
    expect(formatCairo('2026-05-01', 'date')).toContain('2026');
    expect(formatCairo('2026-05-01', 'date')).toContain('1');
  });

  it('returns an em dash for empty or invalid input', () => {
    expect(formatCairo(null)).toBe('—');
    expect(formatCairo('not-a-date')).toBe('—');
    expect(cairoInputToUtc('')).toBeNull();
  });
});
