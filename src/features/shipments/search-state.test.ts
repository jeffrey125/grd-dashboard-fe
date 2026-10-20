import { describe, expect, it } from 'vitest';
import {
  changeSearch,
  listReturnTo,
  readSearch,
  searchErrors,
  searchSchema,
  tabs,
} from './search-state';

describe('shipment URL contract', () => {
  it('orders monitoring views by operational priority', () => {
    expect(Object.entries(tabs)).toEqual([
      ['active', 'Active'],
      ['attention', 'Needs attention'],
      ['delivered', 'Delivered'],
      ['all', 'All Shipments'],
    ]);
  });

  it('defaults to active/newest and preserves literal references', () => {
    expect(searchSchema.parse({})).toMatchObject({
      tab: 'active',
      page: 1,
      pageSize: 25,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    });
    expect(searchSchema.parse({ q: ' 001%_ ' })).toMatchObject({ q: '001%_' });
    expect(searchSchema.parse({ tab: 'paused' }).tab).toBe('attention');
    expect(searchSchema.parse({ sortBy: 'lastAttemptedAt' }).sortBy).toBe('createdAt');
  });
  it.each([
    { lookupOutcome: 'failed' },
    { createdFrom: '2026-10-20' },
    { createdTo: '2026-10-20' },
    { estimatedDeliveryFrom: '2026-02-30' },
    { estimatedDeliveryTo: '0000-10-20' },
    { undeliveredOnly: 'yes' },
    { estimatedDeliveryFrom: '2026-10-21', estimatedDeliveryTo: '2026-10-20' },
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
    expect(
      searchSchema.parse({
        estimatedDeliveryFrom: '2026-10-17',
        estimatedDeliveryTo: '2026-10-23',
        undeliveredOnly: 'true',
      }),
    ).toMatchObject({
      estimatedDeliveryFrom: '2026-10-17',
      estimatedDeliveryTo: '2026-10-23',
      undeliveredOnly: true,
    });
    expect(changeSearch({ tab: 'attention', page: '9', q: '001' }, { q: '' })).toEqual({
      tab: 'attention',
      page: '1',
    });
    expect(changeSearch({}, { page: '3' }, false)).toEqual({ page: '3' });
  });
  it('accepts only the overview or originating internal list as a return destination', () => {
    expect(listReturnTo('/')).toBe('/');
    expect(listReturnTo('/shipments?tab=attention&page=3')).toBe('/shipments?tab=attention&page=3');
    for (const value of [
      'https://evil.example/shipments',
      '//evil.example/shipments',
      '/shipments/new',
      '/login',
      '/?redirect=https://evil.example',
      '//evil.example',
      '/\\evil.example',
    ])
      expect(listReturnTo(value)).toBe('/shipments');
  });
});
