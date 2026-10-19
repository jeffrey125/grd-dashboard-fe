import { safeError } from '@api/api';
import { PageHeader } from '@components/layout/page-header';
import { QuoteProgress } from '@features/shipping-quotes/quote-progress';
import { useComparison } from '@features/shipping-quotes/use-comparison';
import { businessTimestamp } from '@lib/dates';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { createLink, useParams } from '@tanstack/react-router';

const RouterButton = createLink(Button);

export function QuoteDetailPage() {
  const { comparisonId } = useParams({ from: '/quotes/$comparisonId' });
  const query = useComparison(comparisonId);
  if (query.error && !query.data)
    return <Alert severity="error">{safeError(query.error).message}</Alert>;
  if (!query.data) return <Typography>Loading saved comparison…</Typography>;
  const comparison = query.data;
  const input = comparison.input;
  return (
    <>
      <PageHeader title="Saved comparison" />
      <Stack spacing={2}>
        {query.error && (
          <Alert severity="warning">
            Updates unavailable. Showing the last saved result; reconnecting…
          </Alert>
        )}
        <QuoteProgress comparison={comparison} />
        <Alert severity="warning">
          Provider support unverified. Requested signature and insurance are not confirmed.
        </Alert>
        <Stack direction="row" spacing={2}>
          <RouterButton to="/quotes/new" search={{ copy: comparisonId }} variant="contained">
            Copy to new comparison
          </RouterButton>
          <RouterButton to="/quotes" search={{ page: 1 }}>
            All comparisons
          </RouterButton>
        </Stack>
        <Typography>Ship date: {input.shipDate}</Typography>
        <Typography>
          Saved: {businessTimestamp(comparison.createdAt)} ET · Comparison {comparison.externalId}
        </Typography>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6">Destination</Typography>
          <Typography>{Object.values(input.destination).filter(Boolean).join(', ')}</Typography>
        </Paper>
        {input.international && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6">International shipping details</Typography>
            <Typography>Description: {input.international.contentsDescription}</Typography>
            <Typography>
              Total customs value: {input.international.totalValue.amount}{' '}
              {input.international.totalValue.currency}
            </Typography>
            <Typography>
              Detail level: {input.international.customsMode === 'detailed' ? 'Per box' : 'Summary'}
            </Typography>
          </Paper>
        )}
        {input.providers.map((provider) => {
          const sender = comparison.senders.find((s) => s.code === provider.code);
          return (
            <Paper variant="outlined" sx={{ p: 2 }} key={provider.code}>
              <Typography variant="h6">
                {provider.code === 'amazon' ? 'Amazon Shipping' : 'myUnishippers'}
              </Typography>
              <Typography>
                Sender: {sender?.mode === 'account_default' ? 'Account default' : 'Explicit'}
              </Typography>
              <Typography>
                {sender && Object.values(sender.address).filter(Boolean).join(', ')}
              </Typography>
              {sender?.retrievedAt && (
                <Typography>Retrieved: {businessTimestamp(sender.retrievedAt)} ET</Typography>
              )}
              <Typography>Signature requested: {provider.options.signature}</Typography>
              <Typography>
                Insurance requested:{' '}
                {provider.options.insurance
                  ? `${provider.options.insurance.amount} ${provider.options.insurance.currency} per box`
                  : 'None'}
              </Typography>
            </Paper>
          );
        })}
        {input.packageGroups.map((group, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Immutable saved groups retain their original position.
          <Paper variant="outlined" sx={{ p: 2 }} key={`group-${i + 1}`}>
            <Typography variant="h6">Package group {i + 1}</Typography>
            <Typography>
              {group.quantity} boxes ·{' '}
              {group.length === ''
                ? 'Dimensions not provided'
                : `${group.length} × ${group.width} × ${group.height} ${
                    group.units === 'imperial' ? 'in' : 'cm'
                  }`}{' '}
              · {group.weight} {group.units === 'imperial' ? 'lb' : 'kg'} per box
            </Typography>
            {group.customsItems.map((item, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Immutable saved customs items retain their original position.
              <Typography key={`item-${j + 1}`}>
                Per box: {item.quantity} × {item.description} · {item.unitValue} {item.currency}{' '}
                each · Made in {item.countryOfManufacture} · Weight {item.weight}{' '}
                {group.units === 'imperial' ? 'lb' : 'kg'} · HS {item.hsCode ?? 'Not provided'}
              </Typography>
            ))}
          </Paper>
        ))}
      </Stack>
    </>
  );
}
