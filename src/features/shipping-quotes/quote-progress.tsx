import { businessTimestamp } from '@lib/dates';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { type ReactNode, useEffect, useState } from 'react';
import { weightLimitMessage } from './provider-weight-policy';
import { QuoteDecimal } from './quote-decimal';
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
  authentication_failed: 'Could not sign in to this provider. Try again or contact an admin.',
  verification_required:
    'This historical attempt used the retired Amazon browser flow. Retry to use the current API mode.',
  recovery_exhausted: 'This request was interrupted. Try again.',
  provider_setup_required:
    'This historical attempt used the retired Amazon browser onboarding flow. Retry to use the current API mode.',
  provider_failed: 'The provider request failed.',
};

const providerName = (provider: Comparison['attempts'][number]['provider']) =>
  provider === 'amazon' ? 'Amazon Shipping' : 'myUnishippers';

const requestStatus = {
  saved: 'Saved — no prices requested',
  queued: 'Waiting to request prices',
  running: 'Getting prices',
  completed: 'Prices received',
  failed: 'No price available',
};

const validity: Record<string, string> = {
  fresh: 'Current price',
  stale: 'Needs a new quote',
  expired: 'Expired — get a new quote',
  unknown: 'Validity not provided',
};

const retryReasons: Record<string, string> = {
  weight_limit_exceeded:
    'A box exceeds the current provider weight limit. Copy to a new comparison or ask an admin to review the limit.',
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
  children,
}: {
  comparison: Comparison;
  onRetry?: (id: string) => void;
  pending?: boolean;
  children?: ReactNode;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const ranked = rankQuotes(comparison, now);
  // Prioritize current prices without changing exact price ranking or winner eligibility.
  const entries = [
    ...ranked.entries.filter((entry) => entry.freshness === 'fresh'),
    ...ranked.entries.filter((entry) => entry.freshness !== 'fresh'),
  ];
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
        ? 'Waiting to request prices.'
        : comparison.status === 'running'
          ? successes
            ? 'Some prices are ready — waiting for the remaining providers.'
            : 'Getting prices from providers.'
          : successes && failures
            ? 'Completed with partial results.'
            : comparison.status === 'failed'
              ? 'No prices available. Review the provider messages below.'
              : 'Completed.';

  return (
    <Stack spacing={2} aria-live="polite">
      <Alert severity={comparison.status === 'failed' ? 'error' : 'info'}>
        {label} These details are read-only.
      </Alert>
      {comparison.attempts.some((attempt) => attempt.provider === 'amazon' && attempt.simulated) ? (
        <Alert severity="warning">
          Amazon sandbox mode — test data, not live commercial prices. Sandbox rates are excluded
          from Lowest price.
        </Alert>
      ) : comparison.attempts.some((attempt) => attempt.simulated) ? (
        <Alert severity="warning">
          Test data — example prices. Results marked “Test price” are simulated, not live provider
          quotes.
        </Alert>
      ) : null}
      {ranked.warnings.map((warning) => (
        <Alert severity="warning" key={warning}>
          {warning}
        </Alert>
      ))}
      {entries.map(({ key, quote, attempt, freshness, lowest }) => (
        <Paper
          component="article"
          aria-label={`${quote.platform} · ${quote.service}`}
          key={key}
          variant="outlined"
          sx={{ overflow: 'hidden', borderRadius: 2 }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1,
              px: { xs: 2, sm: 3 },
              py: 1.25,
              bgcolor: (theme) =>
                alpha(
                  freshness === 'fresh' ? theme.palette.success.main : theme.palette.warning.main,
                  0.12,
                ),
              color: freshness === 'fresh' ? 'success.main' : 'text.primary',
            }}
          >
            {freshness === 'fresh' && <CheckCircleOutlineIcon fontSize="small" />}
            <Typography sx={{ fontWeight: 600 }}>{validity[freshness]}</Typography>
            {lowest && (
              <Chip label="Lowest price" size="small" sx={{ bgcolor: 'background.paper' }} />
            )}
          </Stack>
          <Stack spacing={2} sx={{ p: { xs: 2, sm: 3 }, overflowWrap: 'anywhere' }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ justifyContent: 'space-between' }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography component="h2" variant="h6">
                  {quote.platform}
                </Typography>
                <Typography color="text.secondary">{quote.service}</Typography>
                {quote.carrier !== quote.platform && (
                  <Typography variant="body2" color="text.secondary">
                    Carrier: {quote.carrier}
                  </Typography>
                )}
              </Box>
              <Box sx={{ textAlign: { xs: 'left', sm: 'right' }, flexShrink: 0 }}>
                <Typography
                  sx={{
                    fontSize: freshness === 'fresh' ? '2.25rem' : '1.75rem',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1.2,
                  }}
                >
                  {quote.currency === 'USD' ? '$' : ''}
                  {new QuoteDecimal(quote.transportationTotal).toFixed(2)}{' '}
                  <Typography component="span" variant="body2">
                    {quote.currency}
                  </Typography>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {quote.estimateMethod === 'calculated'
                    ? 'Calculated estimate'
                    : attempt.provider === 'amazon'
                      ? 'Single-package estimate'
                      : 'Whole-shipment total'}
                </Typography>
                {attempt.simulated && <Typography variant="caption">Test price</Typography>}
              </Box>
            </Stack>
            <Box>
              <Typography>
                Estimated delivery:{' '}
                <Box component="span" sx={{ fontWeight: 600 }}>
                  {quote.transitDescription ?? 'Not provided'}
                </Box>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Delivery time is an estimate.
              </Typography>
            </Box>
            {freshness !== 'fresh' && (
              <Typography variant="body2" color="text.secondary">
                {freshness === 'stale'
                  ? 'This saved price is older. Get a new quote before relying on it.'
                  : freshness === 'expired'
                    ? 'This price has expired. Get a new quote before relying on it.'
                    : 'We could not confirm how long this price is valid. Get a new quote before relying on it.'}
              </Typography>
            )}
            <Accordion
              disableGutters
              elevation={0}
              sx={{
                bgcolor: 'transparent',
                borderTop: 1,
                borderColor: 'divider',
                '&::before': { display: 'none' },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0 }}>
                <Typography color="primary">What’s included in this price?</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1}>
                  <Typography>Requested options: {quote.optionCoverage}</Typography>
                  <Typography>
                    Duty: {quote.dutyStatus} · Tax: {quote.taxStatus} · Clearance:{' '}
                    {quote.clearanceStatus}
                  </Typography>
                  {!quote.expiresAt && (
                    <Typography>
                      Request a new quote after:{' '}
                      {quote.staleAt ? `${businessTimestamp(quote.staleAt)} ET` : 'Not provided'}
                    </Typography>
                  )}
                  {quote.charges.length > 0 && (
                    <Stack spacing={0.25} sx={{ pl: 1 }}>
                      <Typography variant="body2">Charge breakdown</Typography>
                      {quote.charges.map((charge, chargeIndex) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: Charge rows are immutable and retain provider order.
                        <Typography variant="body2" key={`${charge.description}-${chargeIndex}`}>
                          {charge.description}: {new QuoteDecimal(charge.amount).toFixed(2)}{' '}
                          {quote.currency} · {charge.scope}
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
                          Group {contribution.packageGroupPosition + 1}: {contribution.quantity}{' '}
                          box(es)
                          {' · '}
                          {new QuoteDecimal(contribution.subtotal).toFixed(2)} {quote.currency}
                        </Typography>
                      ))}
                    </Stack>
                  )}
                  <Typography>
                    Price received: {businessTimestamp(quote.retrievedAt)} ET · Expires:{' '}
                    {quote.expiresAt ? `${businessTimestamp(quote.expiresAt)} ET` : 'Not provided'}
                  </Typography>
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Stack>
        </Paper>
      ))}
      {latest
        .filter((attempt) => attempt.status !== 'completed')
        .map((attempt) => (
          <Paper key={attempt.externalId} variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6">
              {providerName(attempt.provider)} — {requestStatus[attempt.status]}
            </Typography>
            {attempt.reasonCode && (
              <Alert severity="error" sx={{ my: 1 }}>
                {attempt.reasonCode === 'weight_limit_exceeded'
                  ? weightLimitMessage(attempt.weightPolicy)
                  : (reasons[attempt.reasonCode] ?? 'The provider request failed.')}
              </Alert>
            )}
            {attempt.status === 'failed' && onRetry && (
              <Stack spacing={1}>
                <Button
                  disabled={pending || attempt.retryBlockedReason !== null}
                  onClick={() => onRetry(attempt.externalId)}
                >
                  Retry {providerName(attempt.provider)}
                </Button>
                {attempt.retryBlockedReason && (
                  <Typography>
                    {retryReasons[attempt.retryBlockedReason] ??
                      'Retry is unavailable. Copy to new comparison.'}
                  </Typography>
                )}
              </Stack>
            )}
          </Paper>
        ))}
      {children}
      <Accordion disableGutters variant="outlined">
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Technical details</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Typography variant="h6">Processing history</Typography>
            {comparison.attempts.map((attempt) => (
              <Stack key={attempt.externalId} spacing={0.5}>
                <Typography sx={{ fontWeight: 600 }}>
                  {providerName(attempt.provider)} — {requestStatus[attempt.status]}
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
                {attempt.simulated && (
                  <Typography variant="body2">Test request — simulated result.</Typography>
                )}
                {attempt.reasonCode && (
                  <Typography variant="body2">
                    {attempt.reasonCode === 'weight_limit_exceeded'
                      ? weightLimitMessage(attempt.weightPolicy)
                      : (reasons[attempt.reasonCode] ?? 'The provider request failed.')}
                  </Typography>
                )}
              </Stack>
            ))}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}
