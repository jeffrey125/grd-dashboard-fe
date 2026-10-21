import dayjs from 'dayjs';
import { QuoteDecimal } from './quote-decimal';
import type { Comparison } from './schemas';

type Attempt = Comparison['attempts'][number];
type Quote = Attempt['quotes'][number];

function originKey(attempt: Attempt) {
  const address = attempt.sender?.address;
  if (!address) return null;
  return JSON.stringify(
    [
      address.name,
      address.street,
      address.street2 ?? '',
      address.city,
      address.division,
      address.postalCode,
      address.country,
    ].map((part) => part.trim().toLowerCase()),
  );
}

function optionsKey(comparison: Comparison, attempt: Attempt) {
  const options = comparison.input.providers?.find(
    (provider) => provider.code === attempt.provider,
  )?.options;
  if (!options) return null;
  return JSON.stringify([
    options.signature,
    options.insurance?.currency ?? null,
    options.insurance ? new QuoteDecimal(options.insurance.amount).toString() : null,
  ]);
}

export function rankQuotes(comparison: Comparison, now: number) {
  const entries = comparison.attempts.flatMap((attempt) =>
    attempt.quotes.map((quote, index) => {
      const freshness = quote.expiresAt
        ? dayjs(quote.expiresAt).valueOf() <= now
          ? 'expired'
          : 'fresh'
        : quote.staleAt
          ? dayjs(quote.staleAt).valueOf() <= now
            ? 'stale'
            : 'fresh'
          : 'unknown';
      return { attempt, quote, key: `${attempt.externalId}:${index}`, freshness, lowest: false };
    }),
  );
  const warnings: string[] = [];
  const origins = new Set(entries.map(({ attempt }) => originKey(attempt)));
  const currencies = new Set(entries.map(({ quote }) => quote.currency));
  const options = new Set(entries.map(({ attempt }) => optionsKey(comparison, attempt)));
  if (origins.size > 1) warnings.push('Different provider origins — no overall lowest price.');
  if (origins.has(null))
    warnings.push('Provider origin not provided — price equivalence cannot be verified.');
  if (currencies.size > 1)
    warnings.push(
      'Different native currencies — no overall lowest price. Manual conversion is required.',
    );
  if (options.size > 1 || options.has(null))
    warnings.push('Requested options differ or are unknown — no overall lowest price.');
  if (entries.some(({ attempt }) => attempt.simulated))
    warnings.push('Simulated rates are excluded from Lowest price.');
  const uncovered = entries.some(({ attempt, quote }) => {
    const requested = comparison.input.providers?.find(
      (provider) => provider.code === attempt.provider,
    )?.options;
    return (
      requested &&
      (requested.signature !== 'none' || requested.insurance !== null) &&
      quote.optionCoverage !== 'included'
    );
  });
  if (uncovered)
    warnings.push(
      'Requested option coverage is unverified or unsupported — no overall lowest price.',
    );

  // Destination, ship date and packages are shared immutable input within one comparison.
  const comparable = entries.length > 0 && warnings.length === 0;
  if (comparable) {
    entries.sort((a, b) =>
      new QuoteDecimal(a.quote.transportationTotal).comparedTo(b.quote.transportationTotal),
    );
    const fresh = entries.filter((entry) => entry.freshness === 'fresh');
    const minimum: Quote | undefined = fresh[0]?.quote;
    for (const entry of fresh)
      entry.lowest =
        !!minimum &&
        new QuoteDecimal(entry.quote.transportationTotal).equals(minimum.transportationTotal);
  }
  return { entries, warnings, comparable };
}
