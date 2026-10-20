import { businessTimestamp } from '@lib/dates';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { rankQuotes } from './quote-ranking';
import type { Comparison } from './schemas';

const reasons: Record<string, string> = {
  adapter_unavailable: 'Provider integration not available yet.',
  provider_disabled: 'This provider is disabled.',
  validation_failed: 'The provider rejected these inputs.',
  sender_company_too_long:
    'myUnishippers requires a sender company name of at most 35 characters. Choose Copy to new comparison, select Explicit sender, and correct the name. The provider account address is unchanged.',
  contact_details_required:
    'myUnishippers browser quotes require receiver contact details and, for an explicit sender, origin contact details. Choose Copy to new comparison and enter the contact name and phone number.',
  unsupported: 'This request is not supported by the provider.',
  timeout: 'The provider request timed out.',
  authentication_failed: 'Authentication failed after one relogin attempt.',
  recovery_exhausted: 'The worker could not recover this attempt.',
  provider_failed: 'The provider request failed.',
};

const retryReasons: Record<string, string> = {
  provider_disabled: 'Provider disabled. A new comparison is required with an available provider.',
  ship_date_passed: 'Ship date has passed. Copy to new comparison and choose a new date.',
  input_invalid: 'Current validation rejects these inputs. Copy to new comparison to correct them.',
  outcome_not_retryable:
    'This outcome cannot be retried. Copy to new comparison to change the inputs.',
  newer_attempt: 'A newer attempt exists for this provider.',
  attempt_active: 'This provider already has a queued or running attempt.',
  comparison_deleted: 'Restore this comparison before retrying.',
};

export function QuoteProgress({
  comparison,
  onRetry,
  pending = false,
}: {
  comparison: Comparison;
  onRetry?: (id: string) => void;
  pending?: boolean;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const ranked = rankQuotes(comparison, now);
  const latest = comparison.attempts.filter(
    (attempt) =>
      !comparison.attempts.some(
        (other) =>
          other.provider === attempt.provider && other.attemptNumber > attempt.attemptNumber,
      ),
  );
  const successes = latest.filter((attempt) => attempt.status === 'completed').length;
  const failures = latest.filter((attempt) => attempt.status === 'failed').length;
  const label =
    comparison.status === 'saved'
      ? 'Saved — no rates run.'
      : comparison.status === 'queued'
        ? 'Queued — waiting for the worker.'
        : comparison.status === 'running'
          ? successes
            ? 'Partial results — other providers are still running.'
            : 'Running — requesting provider results.'
          : successes && failures
            ? 'Completed with partial results.'
            : comparison.status === 'failed'
              ? 'Failed — no rates available.'
              : 'Completed.';

  return (
    <Stack spacing={2} aria-live="polite">
      <Alert severity={comparison.status === 'failed' ? 'error' : 'info'}>
        {label} These details are read-only.
      </Alert>
      {ranked.warnings.map((warning) => (
        <Alert severity="warning" key={warning}>
          {warning}
        </Alert>
      ))}
      {ranked.comparable && ranked.entries.length > 1 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6">Comparable services — price low to high</Typography>
          {ranked.entries.map((entry) => (
            <Typography key={entry.key}>
              {entry.quote.platform} · {entry.quote.service}: {entry.quote.transportationTotal}{' '}
              {entry.quote.currency} · {entry.freshness}
            </Typography>
          ))}
        </Paper>
      )}
      {comparison.attempts.map((attempt) => (
        <Paper key={attempt.externalId} variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6">
            {attempt.provider === 'amazon' ? 'Amazon Shipping' : 'myUnishippers'} — {attempt.status}
          </Typography>
          <Typography>
            Attempt {attempt.attemptNumber} · Mode: {attempt.executionMode ?? 'Not started'}
          </Typography>
          <Typography>
            Queued: {businessTimestamp(attempt.createdAt ?? null)} ET · Started:{' '}
            {businessTimestamp(attempt.startedAt)} ET · Completed:{' '}
            {businessTimestamp(attempt.completedAt)} ET
          </Typography>
          <Typography>
            Actual provider origin:{' '}
            {attempt.sender
              ? Object.values(attempt.sender.address).filter(Boolean).join(', ')
              : 'Not provided'}
          </Typography>
          {attempt.sender?.retrievedAt && (
            <Typography>
              Origin retrieved: {businessTimestamp(attempt.sender.retrievedAt)} ET
            </Typography>
          )}
          {attempt.status === 'failed' && onRetry && (
            <Stack spacing={1}>
              <Button
                disabled={pending || attempt.retryBlockedReason !== null}
                onClick={() => onRetry(attempt.externalId)}
              >
                Retry {attempt.provider === 'amazon' ? 'Amazon Shipping' : 'myUnishippers'}
              </Button>
              {attempt.retryBlockedReason && (
                <Typography>
                  {retryReasons[attempt.retryBlockedReason] ??
                    'Retry is unavailable. Copy to new comparison.'}
                </Typography>
              )}
            </Stack>
          )}
          {attempt.simulated && (
            <Alert severity="warning">Simulated rates — not provider quotes.</Alert>
          )}
          {attempt.reasonCode && (
            <Alert severity="error">
              {reasons[attempt.reasonCode] ?? 'The provider request failed.'}
            </Alert>
          )}
          {attempt.quotes.map((quote, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Completed attempt results are immutable and retain database order.
            <Stack spacing={0.5} key={`${quote.service}-${index}`} sx={{ mt: 1 }}>
              <Typography>
                {quote.platform} · {quote.carrier} · {quote.service}
              </Typography>
              <Typography>
                {quote.transportationTotal} {quote.currency} ·{' '}
                {quote.estimateMethod === 'calculated'
                  ? 'Calculated estimate'
                  : attempt.provider === 'amazon'
                    ? 'Single-package estimate'
                    : 'Whole-shipment total'}
              </Typography>
              <Typography>Transit: {quote.transitDescription ?? 'Not provided'}</Typography>
              {ranked.entries.find((entry) => entry.key === `${attempt.externalId}:${index}`)
                ?.lowest && <Chip label="Lowest price" color="success" size="small" />}
              <Typography>
                Rate status:{' '}
                {ranked.entries.find((entry) => entry.key === `${attempt.externalId}:${index}`)
                  ?.freshness ?? 'unknown'}
              </Typography>
              <Typography>Requested options: {quote.optionCoverage}</Typography>
              <Typography>
                Duty: {quote.dutyStatus} · Tax: {quote.taxStatus} · Clearance:{' '}
                {quote.clearanceStatus}
              </Typography>
              {!quote.expiresAt && (
                <Typography>
                  Stale after:{' '}
                  {quote.staleAt ? `${businessTimestamp(quote.staleAt)} ET` : 'Not provided'}
                </Typography>
              )}
              {quote.charges.length > 0 && (
                <Stack spacing={0.25} sx={{ pl: 1 }}>
                  <Typography variant="body2">Charge breakdown</Typography>
                  {quote.charges.map((charge, chargeIndex) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: Charge rows are immutable and retain provider order.
                    <Typography variant="body2" key={`${charge.description}-${chargeIndex}`}>
                      {charge.description}: {charge.amount} {quote.currency} · {charge.scope}
                      {charge.packageGroupPosition === null
                        ? ''
                        : ` · Group ${charge.packageGroupPosition + 1}`}
                    </Typography>
                  ))}
                </Stack>
              )}
              {quote.groupContributions.length > 0 && (
                <Stack spacing={0.25} sx={{ pl: 1 }}>
                  <Typography variant="body2">Package group contribution</Typography>
                  {quote.groupContributions.map((contribution) => (
                    <Typography variant="body2" key={contribution.packageGroupPosition}>
                      Group {contribution.packageGroupPosition + 1}: {contribution.quantity} box(es)
                      {' · '}
                      {contribution.subtotal} {quote.currency}
                    </Typography>
                  ))}
                </Stack>
              )}
              <Typography>
                Retrieved: {businessTimestamp(quote.retrievedAt)} ET · Expires:{' '}
                {quote.expiresAt ? `${businessTimestamp(quote.expiresAt)} ET` : 'Not provided'}
              </Typography>
            </Stack>
          ))}
        </Paper>
      ))}
    </Stack>
  );
}
