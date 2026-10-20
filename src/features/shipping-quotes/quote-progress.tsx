import { businessTimestamp } from '@lib/dates';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
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
  recovery_exhausted: 'This request was interrupted. Try again.',
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
  fresh: 'Current',
  stale: 'Needs a new quote',
  expired: 'Expired — get a new quote',
  unknown: 'Validity not provided',
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
      {comparison.attempts.some((attempt) => attempt.simulated) && (
        <Alert severity="warning">
          Test data — example prices. Results marked “Test price” are simulated, not live provider
          quotes.
        </Alert>
      )}
      {ranked.warnings.map((warning) => (
        <Alert severity="warning" key={warning}>
          {warning}
        </Alert>
      ))}
      {ranked.entries.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" id="shipping-prices-heading">
            Shipping prices
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {ranked.comparable ? 'Prices from low to high. ' : ''}
            Only current, comparable prices qualify for Lowest price. Delivery times are estimates.
          </Typography>
          <TableContainer>
            <Table
              aria-labelledby="shipping-prices-heading"
              size="small"
              sx={{
                display: { xs: 'block', sm: 'table' },
                '& th, & td': {
                  px: { xs: 1, sm: 2 },
                  py: 1.5,
                  verticalAlign: 'top',
                  minWidth: 0,
                  borderBottom: { xs: 0, sm: undefined },
                },
              }}
            >
              <TableHead sx={{ display: { xs: 'none', sm: 'table-header-group' } }}>
                <TableRow>
                  <TableCell>Provider / service</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell>Est. transit</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody sx={{ display: { xs: 'block', sm: 'table-row-group' } }}>
                {ranked.entries.map((entry) => (
                  <TableRow
                    key={entry.key}
                    sx={{
                      bgcolor: entry.lowest ? 'action.selected' : undefined,
                      display: { xs: 'grid', sm: 'table-row' },
                      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                      '& + tr': { borderTop: { xs: 1, sm: 0 }, borderColor: 'divider' },
                      '& > th, & > td': { display: { xs: 'block', sm: 'table-cell' } },
                    }}
                  >
                    <TableCell component="th" scope="row">
                      <Typography sx={{ fontWeight: 600 }}>{entry.quote.platform}</Typography>
                      <Typography variant="body2">{entry.quote.service}</Typography>
                      {entry.quote.carrier !== entry.quote.platform && (
                        <Typography variant="caption" color="text.secondary">
                          Carrier: {entry.quote.carrier}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {new QuoteDecimal(entry.quote.transportationTotal).toFixed(2)}{' '}
                        {entry.quote.currency}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {entry.quote.estimateMethod === 'calculated'
                          ? 'Calculated estimate'
                          : entry.attempt.provider === 'amazon'
                            ? 'Single-package estimate'
                            : 'Whole-shipment total'}
                      </Typography>
                      {entry.attempt.simulated && (
                        <Typography variant="caption" sx={{ display: 'block' }}>
                          Test price
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: { xs: 'block', sm: 'none' } }}
                      >
                        Est. transit
                      </Typography>
                      {entry.quote.transitDescription ?? 'Not provided'}
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: { xs: 'block', sm: 'none' } }}
                        >
                          Status
                        </Typography>
                        <Typography
                          variant="body2"
                          color={entry.freshness === 'fresh' ? 'success.main' : 'text.secondary'}
                        >
                          {validity[entry.freshness]}
                        </Typography>
                        {entry.lowest && <Chip label="Lowest price" color="success" size="small" />}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
      {latest
        .filter((attempt) => attempt.status !== 'completed')
        .map((attempt) => (
          <Paper key={attempt.externalId} variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6">
              {providerName(attempt.provider)} — {requestStatus[attempt.status]}
            </Typography>
            {attempt.reasonCode && (
              <Alert severity="error" sx={{ my: 1 }}>
                {reasons[attempt.reasonCode] ?? 'The provider request failed.'}
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
      {ranked.entries.map(({ key, quote }) => (
        <Accordion key={key} disableGutters variant="outlined">
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>
              View price breakdown — {quote.platform} · {quote.service}
            </Typography>
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
                      Group {contribution.packageGroupPosition + 1}: {contribution.quantity} box(es)
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
      ))}
      <Accordion disableGutters variant="outlined">
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Processing history</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
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
                    {reasons[attempt.reasonCode] ?? 'The provider request failed.'}
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
