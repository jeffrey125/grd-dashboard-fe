import { describe, expect, it } from 'vitest';

import { parsePublicConfig } from './public-config';

describe('public API configuration', () => {
  it('defaults only an omitted origin and exposes no unrelated environment values', () => {
    expect(parsePublicConfig({ PRIVATE_VALUE: 'private-test-sentinel' })).toEqual({
      apiOrigin: 'http://localhost:3000',
    });
  });

  it.each([
    ['https://example.com/', 'https://example.com'],
    ['http://localhost:3000', 'http://localhost:3000'],
    ['http://[::1]:3000/', 'http://[::1]:3000'],
  ])('normalizes the valid origin %s', (input, expected) => {
    expect(parsePublicConfig({ VITE_API_ORIGIN: input }).apiOrigin).toBe(expected);
  });

  it.each([
    '',
    'not-a-url',
    '/relative',
    'ftp://example.com',
    'https://example.com/api',
    'https://example.com/?key=private-test-sentinel',
    'https://example.com/#private-test-sentinel',
    'https://user:private-test-sentinel@example.com',
    null,
    42,
  ])('rejects invalid configuration without echoing its value: %s', (input) => {
    expect(() => parsePublicConfig({ VITE_API_ORIGIN: input })).toThrow(
      /^VITE_API_ORIGIN must be an HTTP\(S\) origin without credentials, a path, query, or fragment\.$/,
    );
  });
});
