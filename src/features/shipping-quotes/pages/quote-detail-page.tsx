import { safeError } from '@api/api';
import { PageHeader } from '@components/layout/page-header';
import { useSession } from '@features/auth';
import { AmazonVerificationDialog } from '@features/shipping-quotes/amazon-verification-dialog';
import { changeComparison } from '@features/shipping-quotes/api';
import { QuoteDecimal } from '@features/shipping-quotes/quote-decimal';
import { QuoteProgress } from '@features/shipping-quotes/quote-progress';
import { useComparison } from '@features/shipping-quotes/use-comparison';
import { businessTimestamp, parseCalendarDate } from '@lib/dates';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createLink, useParams } from '@tanstack/react-router';
import { useState } from 'react';

const RouterButton = createLink(Button);

export function QuoteDetailPage() {
  const { comparisonId } = useParams({ from: '/quotes/$comparisonId' });
  const query = useComparison(comparisonId);
  const { session, account } = useSession();
  const queries = useQueryClient();
  const [verificationAttempt, setVerificationAttempt] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mutation = useMutation({
    mutationFn: (action: Parameters<typeof changeComparison>[2]) =>
      changeComparison(session.client, comparisonId, action),
    onSuccess: async () => {
      setConfirmDelete(false);
      await queries.invalidateQueries({ queryKey: ['quote-comparison', comparisonId] });
      await queries.invalidateQueries({ queryKey: ['quote-comparisons'] });
    },
    onError: async () => {
      await queries.invalidateQueries({ queryKey: ['quote-comparison', comparisonId] });
    },
  });
  if (query.error && (!query.data || [401, 403, 404].includes(safeError(query.error).status)))
    return <Alert severity="error">{safeError(query.error).message}</Alert>;
  if (!query.data) return <Typography>Loading saved comparison…</Typography>;
  const comparison = query.data;
  const input = comparison.input;
  const boxCount = input.packageGroups.reduce((total, group) => total + group.quantity, 0);
  return (
    <>
      <PageHeader title="Your shipping prices" />
      {verificationAttempt && (
        <AmazonVerificationDialog
          key={verificationAttempt}
          comparisonId={comparisonId}
          attemptId={verificationAttempt}
          client={session.client}
          onClose={() => setVerificationAttempt(null)}
          onVerified={async () => {
            await mutation.mutateAsync({ type: 'retry', attemptId: verificationAttempt });
            setVerificationAttempt(null);
          }}
        />
      )}
      <Stack spacing={2}>
        {query.error && (
          <Alert severity="warning">
            Updates unavailable. Showing the last saved result; reconnecting…
          </Alert>
        )}
        {mutation.error && <Alert severity="error">{safeError(mutation.error).message}</Alert>}
        {comparison.deletedAt && (
          <Alert severity="warning">
            Deleted comparison — visible only to admins. Restore to make it available to staff.
          </Alert>
        )}
        <Typography color="text.secondary">
          For {input.destination.name} · {input.destination.city}, {input.destination.division},{' '}
          {input.destination.country}
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider', pb: 2 }}
        >
          <Stack>
            <Typography variant="body2" color="text.secondary">
              Shipment
            </Typography>
            <Typography sx={{ fontWeight: 600 }}>
              {boxCount} {boxCount === 1 ? 'box' : 'boxes'} to {input.destination.city}
            </Typography>
          </Stack>
          <Stack>
            <Typography variant="body2" color="text.secondary">
              Shipping date
            </Typography>
            <Typography sx={{ fontWeight: 600 }}>
              {parseCalendarDate(input.shipDate).format('MMMM D, YYYY')}
            </Typography>
          </Stack>
          <Stack>
            <Typography variant="body2" color="text.secondary">
              Saved
            </Typography>
            <Typography>{businessTimestamp(comparison.createdAt)} ET</Typography>
          </Stack>
        </Stack>
        <QuoteProgress
          comparison={comparison}
          pending={mutation.isPending}
          onVerifyAmazon={setVerificationAttempt}
          onRetry={(attemptId) => mutation.mutate({ type: 'retry', attemptId })}
        >
          <Accordion disableGutters variant="outlined">
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Check shipment details</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <Typography>Ship date: {input.shipDate}</Typography>
                <Typography>
                  Saved: {businessTimestamp(comparison.createdAt)} ET · Comparison{' '}
                  {comparison.externalId}
                </Typography>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6">Destination</Typography>
                  <Typography>
                    {Object.values(input.destination).filter(Boolean).join(', ')}
                  </Typography>
                </Paper>
                {input.international && (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="h6">International shipping details</Typography>
                    <Typography>Description: {input.international.contentsDescription}</Typography>
                    <Typography>
                      Total customs value:{' '}
                      {new QuoteDecimal(input.international.totalValue.amount).toFixed(2)}{' '}
                      {input.international.totalValue.currency}
                    </Typography>
                    <Typography>
                      Detail level:{' '}
                      {input.international.customsMode === 'detailed' ? 'Per box' : 'Summary'}
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
                        Sender:{' '}
                        {sender?.mode === 'account_default'
                          ? 'Provider account address'
                          : 'Address entered for this comparison'}
                      </Typography>
                      <Typography>
                        {sender && Object.values(sender.address).filter(Boolean).join(', ')}
                      </Typography>
                      {sender?.retrievedAt && (
                        <Typography>
                          Retrieved: {businessTimestamp(sender.retrievedAt)} ET
                        </Typography>
                      )}
                      <Typography>
                        Signature requested:{' '}
                        {
                          {
                            none: 'None',
                            signature: 'Signature required',
                            adult_signature: 'Adult signature required',
                          }[provider.options.signature]
                        }
                      </Typography>
                      <Typography>
                        Insurance requested:{' '}
                        {provider.options.insurance
                          ? `${new QuoteDecimal(provider.options.insurance.amount).toFixed(2)} ${provider.options.insurance.currency} per box`
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
                        Per box: {item.quantity} × {item.description} ·{' '}
                        {new QuoteDecimal(item.unitValue).toFixed(2)} {item.currency} each · Made in{' '}
                        {item.countryOfManufacture} · Weight {item.weight}{' '}
                        {group.units === 'imperial' ? 'lb' : 'kg'} · HS{' '}
                        {item.hsCode ?? 'Not provided'}
                      </Typography>
                    ))}
                  </Paper>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
          <Accordion disableGutters variant="outlined">
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Help getting an updated price</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography>
                Choose “Copy to new comparison,” check the shipping date and package details, then
                save the new comparison to request prices again.
                {comparison.deletedAt && ' Restore this comparison before copying it.'}
              </Typography>
            </AccordionDetails>
          </Accordion>
        </QuoteProgress>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <RouterButton
            to="/quotes/new"
            search={{ copy: comparisonId }}
            variant="contained"
            disabled={!!comparison.deletedAt}
          >
            Copy to new comparison
          </RouterButton>
          <RouterButton to="/quotes" search={{ page: 1 }}>
            All comparisons
          </RouterButton>
          {account?.role === 'admin' &&
            (comparison.deletedAt ? (
              <Button
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ type: 'restore' })}
              >
                Restore comparison
              </Button>
            ) : (
              <Button
                color="error"
                disabled={
                  mutation.isPending || !['completed', 'failed'].includes(comparison.status)
                }
                onClick={() => setConfirmDelete(true)}
              >
                Delete comparison
              </Button>
            ))}
        </Stack>
        {comparison.lastDeletedAt && (
          <Typography>Last deleted: {businessTimestamp(comparison.lastDeletedAt)} ET</Typography>
        )}
        {comparison.restoredAt && (
          <Typography>Last restored: {businessTimestamp(comparison.restoredAt)} ET</Typography>
        )}
        <Dialog open={confirmDelete} onClose={() => !mutation.isPending && setConfirmDelete(false)}>
          <DialogTitle>Delete comparison?</DialogTitle>
          <DialogContent>
            Comparison {comparison.externalId} will be hidden from staff. All attempts and rates are
            retained, and admins can restore it.
          </DialogContent>
          <DialogActions>
            <Button disabled={mutation.isPending} onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              color="error"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ type: 'delete' })}
            >
              Confirm delete
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </>
  );
}
