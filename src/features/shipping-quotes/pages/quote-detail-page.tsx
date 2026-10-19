import { safeError } from '@api/api';
import { PageHeader } from '@components/layout/page-header';
import { useSession } from '@features/auth';
import { getComparison } from '@features/shipping-quotes/api';
import { businessTimestamp } from '@lib/dates';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { createLink, useParams } from '@tanstack/react-router';

const RouterButton = createLink(Button);

export function QuoteDetailPage() {
  const { session } = useSession();
  const { comparisonId } = useParams({ from: '/quotes/$comparisonId' });
  const query = useQuery({
    queryKey: ['quote-comparison', comparisonId],
    queryFn: ({ signal }) => getComparison(session.client, comparisonId, signal),
  });
  if (query.error) return <Alert severity="error">{safeError(query.error).message}</Alert>;
  if (!query.data) return <Typography>Loading saved comparison…</Typography>;
  const comparison = query.data;
  const input = comparison.input;
  return (
    <>
      <PageHeader title="Saved comparison" />
      <Stack spacing={2}>
        <Alert severity="info">Saved — no rates run. These details are read-only.</Alert>
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
                  ? `${provider.options.insurance.amount} ${provider.options.insurance.currency}`
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
              {group.quantity} boxes · {group.length} × {group.width} × {group.height}{' '}
              {group.units === 'imperial' ? 'in' : 'cm'} · {group.weight}{' '}
              {group.units === 'imperial' ? 'lb' : 'kg'} per box
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
