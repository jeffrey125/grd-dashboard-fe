import { carrierFixture } from '@test/carrier-fixture';
import { describe, expect, it } from 'vitest';
import { changedSettings, patchSchema, settings, settingsFor } from './schemas';

describe('carrier settings contract', () => {
  it('normalizes names, permits null RPM only and preserves omitted settings', () => {
    expect(patchSchema.parse({ name: ' New name ', rateLimitPerMinute: null })).toEqual({
      name: 'New name',
      rateLimitPerMinute: null,
    });
    expect(
      changedSettings(settings(carrierFixture), {
        ...settings(carrierFixture),
        pollIntervalMinutes: 20,
      }),
    ).toEqual({ pollIntervalMinutes: 20 });
    expect(changedSettings(settings(carrierFixture), settings(carrierFixture))).toEqual({});
  });
  it.each([
    {},
    { name: '' },
    { name: 'x'.repeat(101) },
    { name: 'bad\0' },
    { externalId: carrierFixture.externalId },
    { code: 'ffe' },
    { credentials: 'secret' },
    { pollIntervalMinutes: null },
    { notFoundPauseThreshold: null },
    { isActive: null },
    { fetchMode: null },
    { name: null },
    { pollIntervalMinutes: 0 },
    { pollIntervalMinutes: 32768 },
    { notFoundPauseThreshold: 1 },
    { notFoundPauseThreshold: 32768 },
    { rateLimitPerMinute: 0 },
    { rateLimitPerMinute: 32768 },
    { rateLimitPerMinute: 1.5 },
    { pollIntervalMinutes: '30' },
  ])('rejects unsupported/null/range/coerced input %j', (input) => {
    expect(patchSchema.safeParse(input).success).toBe(false);
  });
  it('enforces carrier modes and integer boundaries', () => {
    for (const code of ['ups', 'ffe', 'echoship']) {
      expect(
        settingsFor(code).safeParse({ ...settings(carrierFixture), rateLimitPerMinute: null })
          .success,
      ).toBe(true);
      expect(
        settingsFor(code).safeParse({ ...settings(carrierFixture), fetchMode: 'browser' }).success,
      ).toBe(code !== 'ups');
    }
    expect(
      patchSchema.parse({
        pollIntervalMinutes: 1,
        notFoundPauseThreshold: 2,
        rateLimitPerMinute: 32767,
      }),
    ).toBeTruthy();
  });
});
