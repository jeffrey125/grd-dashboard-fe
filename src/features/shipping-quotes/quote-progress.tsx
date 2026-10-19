import { businessTimestamp } from '@lib/dates';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
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

export function QuoteProgress({ comparison }: { comparison: Comparison }) {
  const successes = comparison.attempts.filter((attempt) => attempt.status === 'completed').length;
  const failures = comparison.attempts.filter((attempt) => attempt.status === 'failed').length;
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
      {comparison.attempts.map((attempt) => (
        <Paper key={attempt.externalId} variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6">
            {attempt.provider === 'amazon' ? 'Amazon Shipping' : 'myUnishippers'} — {attempt.status}
          </Typography>
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
              <Typography>Requested options: {quote.optionCoverage}</Typography>
              <Typography>
                Duty: {quote.dutyStatus} · Tax: {quote.taxStatus} · Clearance:{' '}
                {quote.clearanceStatus}
              </Typography>
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
