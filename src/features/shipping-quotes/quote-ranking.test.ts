import { describe, expect, it } from 'vitest';
import { rankQuotes } from './quote-ranking';
import type { Comparison } from './schemas';

const now = Date.parse('2026-10-20T12:00:00Z');
const origin = {
  name: 'Warehouse',
  street: '1 Example St',
  city: 'Walworth',
  division: 'WI',
  postalCode: '53125',
  country: 'US',
};
const quote = (total: string, overrides = {}) => ({
  service: total,
  transportationTotal: total,
  currency: 'USD',
  retrievedAt: '2026-10-20T10:00:00Z',
  expiresAt: null,
  staleAt: '2026-10-21T10:00:00Z',
  optionCoverage: 'included',
  ...overrides,
});
function comparison(): Comparison {
  return {
    input: {
      providers: ['amazon', 'unishippers'].map((code) => ({
        code,
        options: { signature: 'none', insurance: null },
      })),
    },
    attempts: ['amazon', 'unishippers'].map((provider, index) => ({
      externalId: provider,
      provider,
      attemptNumber: 1,
      sender: { address: origin },
      simulated: false,
      quotes: [quote(index === 0 ? '20.000001' : '20.000002')],
    })),
  } as Comparison;
}

function present<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Required fixture is missing');
  return value;
}

describe('Quote ranking', () => {
  it('ranks equivalent fresh prices exactly and excludes expired or stale results', () => {
    const value = comparison();
    present(value.attempts[0]).quotes.push(
      quote('1', {
        expiresAt: '2026-10-20T11:00:00Z',
      }) as Comparison['attempts'][number]['quotes'][number],
    );
    present(value.attempts[1]).quotes.push(
      quote('2', {
        staleAt: '2026-10-20T11:00:00Z',
      }) as Comparison['attempts'][number]['quotes'][number],
    );
    const ranked = rankQuotes(value, now);
    expect(
      ranked.entries
        .filter((entry) => entry.lowest)
        .map((entry) => entry.quote.transportationTotal),
    ).toEqual(['20.000001']);
    expect(ranked.entries.map((entry) => entry.freshness)).toContain('expired');
    expect(ranked.entries.map((entry) => entry.freshness)).toContain('stale');
  });

  it.each(['origin', 'currency', 'options', 'coverage', 'simulation'] as const)(
    'withholds an overall winner when %s differs',
    (difference) => {
      const value = comparison();
      const attempt = present(value.attempts[1]);
      if (difference === 'origin')
        present(attempt.sender).address = { ...origin, postalCode: '53126' };
      if (difference === 'currency') present(attempt.quotes[0]).currency = 'CAD';
      if (difference === 'options')
        present(value.input.providers[1]).options.signature = 'signature';
      if (difference === 'coverage') {
        value.input.providers.forEach((provider) => {
          provider.options.signature = 'signature';
        });
        present(attempt.quotes[0]).optionCoverage = 'unverified';
      }
      if (difference === 'simulation') attempt.simulated = true;
      const ranked = rankQuotes(value, now);
      expect(ranked.comparable).toBe(false);
      expect(ranked.warnings.length).toBeGreaterThan(0);
      expect(ranked.entries.some((entry) => entry.lowest)).toBe(false);
    },
  );

  it('preserves ties and removes every badge when all quotes age out', () => {
    const value = comparison();
    present(present(value.attempts[1]).quotes[0]).transportationTotal = '20.000001';
    expect(rankQuotes(value, now).entries.filter((entry) => entry.lowest)).toHaveLength(2);
    expect(
      rankQuotes(value, Date.parse('2026-10-22T12:00:00Z')).entries.some((entry) => entry.lowest),
    ).toBe(false);
  });

  it('treats provider expiry as authoritative even beyond a stale threshold', () => {
    const value = comparison();
    Object.assign(present(present(value.attempts[0]).quotes[0]), {
      expiresAt: '2026-10-21T12:00:00Z',
      staleAt: '2026-10-19T12:00:00Z',
    });
    expect(rankQuotes(value, now).entries[0]).toMatchObject({ freshness: 'fresh', lowest: true });
  });
});
