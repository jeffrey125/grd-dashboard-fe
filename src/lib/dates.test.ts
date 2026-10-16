import { expect, it } from 'vitest';
import { businessTimestamp, parseCalendarDate } from './dates';

it('preserves date-only values including leap days and early years without rollover', () => {
  for (const value of [
    '2024-02-29',
    '2026-03-08',
    '2026-11-01',
    '0004-02-29',
    '0099-01-01',
    '9999-12-31',
  ]) {
    expect(parseCalendarDate(value).format('YYYY-MM-DD')).toBe(value);
  }
  for (const value of ['2025-02-29', '2026-04-31', '0000-01-01', 'tomorrow', '2026-1-1']) {
    expect(parseCalendarDate(value).isValid()).toBe(false);
  }
});
it('formats timestamps in New York across daylight saving transitions', () => {
  expect(businessTimestamp('2026-03-08T06:30:00Z')).toBe('Mar 8, 2026, 1:30 AM');
  expect(businessTimestamp('2026-03-08T07:30:00Z')).toBe('Mar 8, 2026, 3:30 AM');
  expect(businessTimestamp(null)).toBe('Not available');
});
