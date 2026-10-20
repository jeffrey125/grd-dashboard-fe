import { safeError } from '@api/api';
import { PageHeader } from '@components/layout/page-header';
import { useSession } from '@features/auth';
import {
  getComparison,
  getProviders,
  refreshSender,
  saveComparison,
} from '@features/shipping-quotes/api';
import { QuoteForm } from '@features/shipping-quotes/quote-form';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { v4 as randomUUID } from 'uuid';

export function NewQuotePage() {
  const { session } = useSession();
  const { copy } = useSearch({ from: '/quotes/new' });
  const navigate = useNavigate();
  const queries = useQueryClient();
  const providers = useQuery({
    queryKey: ['quote-providers'],
    queryFn: ({ signal }) => getProviders(session.client, signal),
  });
  const source = useQuery({
    queryKey: ['quote-comparison', copy],
    queryFn: ({ signal }) => getComparison(session.client, copy ?? '', signal),
    enabled: !!copy,
  });
  if (providers.error || source.error)
    return <Alert severity="error">{safeError(providers.error || source.error).message}</Alert>;
  if (!providers.data || (copy && !source.data))
    return <Typography>Loading comparison form…</Typography>;
  const initial = source.data
    ? {
        ...source.data.input,
        idempotencyKey: randomUUID(),
        providers: source.data.input.providers
          .filter((p) =>
            providers.data.some((current) => current.code === p.code && current.enabled),
          )
          .map((p) => ({
            ...p,
            sender:
              p.sender.mode === 'account_default'
                ? { mode: 'account_default' as const, refreshId: '' }
                : p.sender,
          })),
      }
    : undefined;
  return (
    <>
      <PageHeader title={copy ? 'Copy to new comparison' : 'New quote comparison'} />
      {copy && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This copy will be saved separately. Account defaults refresh again; update an old ship
          date before saving. Disabled providers are omitted.
        </Alert>
      )}
      <QuoteForm
        key={copy ?? 'new'}
        providers={providers.data}
        initial={initial}
        onRefresh={(code) => refreshSender(session.client, code)}
        onSave={async (input) => {
          const result = await saveComparison(session.client, input);
          await queries.invalidateQueries({ queryKey: ['quote-comparisons'] });
          await navigate({
            to: '/quotes/$comparisonId',
            params: { comparisonId: result.comparison.externalId },
          });
        }}
      />
    </>
  );
}
