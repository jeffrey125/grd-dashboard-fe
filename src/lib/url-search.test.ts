import { expect, it } from 'vitest';
import { urlSearch } from './url-search';

it('round-trips literal search references and nested return URLs without numeric precision loss', () => {
  for (const q of ['000123', '123456789012345678901', 'null', '"reference"', 'true', 'a+b%_']) {
    const parsed = urlSearch.parseSearch(urlSearch.stringifySearch({ q, page: '2' })) as Record<
      string,
      unknown
    >;
    expect(String(parsed.q)).toBe(q);
    expect(String(parsed.page)).toBe('2');
  }
  const returnTo = '/shipments?q=00123&page=2';
  expect(urlSearch.parseSearch(urlSearch.stringifySearch({ returnTo }))).toEqual({ returnTo });
  expect(urlSearch.stringifySearch({ page: '2' })).toBe('?page=2');
});
