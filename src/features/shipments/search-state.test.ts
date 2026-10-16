import { describe, expect, it } from 'vitest';
import { changeSearch, listReturnTo, readSearch, searchErrors, searchSchema } from './search-state';

describe('shipment URL contract', () => {
  it('defaults to active/newest, preserving literal references and date-only filters', () => {
    expect(searchSchema.parse({})).toMatchObject({
      tab: 'active',
      page: 1,
      pageSize: 25,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    });
    expect(
      searchSchema.parse({ q: ' 001%_ ', createdFrom: '2024-02-29', undeliveredOnly: 'true' }),
    ).toMatchObject({ q: '001%_', createdFrom: '2024-02-29', undeliveredOnly: true });
  });
  it.each([
    { createdFrom: '2025-02-29' },
    { createdFrom: '0000-01-01' },
    { createdFrom: '2026-10-20', createdTo: '2026-10-10' },
    { estimatedDeliveryFrom: '2026-10-20', estimatedDeliveryTo: '2026-10-10' },
    { page: '0' },
    { page: '9007199254740991', pageSize: '100' },
    { pageSize: '10' },
    { sortBy: 'carrierStatus' },
    { carrierExternalId: 'bad' },
    { mystery: 'filter' },
    { q: 'nul\0' },
    { tab: 'invalid' },
  ])('keeps invalid state editable and blocks the API: %j', (value) => {
    const raw = readSearch(value);
    expect(raw).toEqual(value);
    expect(searchSchema.safeParse(raw).success).toBe(false);
    expect(Object.keys(searchErrors(raw)).length).toBeGreaterThan(0);
  });
  it('resets page for changed filters and retains it for pagination', () => {
    expect(changeSearch({ tab: 'paused', page: '9', q: '001' }, { q: '' })).toEqual({
      tab: 'paused',
      page: '1',
    });
    expect(changeSearch({}, { page: '3' }, false)).toEqual({ page: '3' });
  });
  it('accepts only the originating internal list as a return destination', () => {
    expect(listReturnTo('/shipments?tab=paused&page=3')).toBe('/shipments?tab=paused&page=3');
    for (const value of [
      'https://evil.example/shipments',
      '//evil.example/shipments',
      '/shipments/new',
      '/login',
    ])
      expect(listReturnTo(value)).toBe('/shipments');
  });
});
