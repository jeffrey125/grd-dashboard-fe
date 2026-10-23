import { safeError } from '@api/api';
import { PageHeader } from '@components/layout/page-header';
import { useSession } from '@features/auth';
import {
  getProviderReadiness,
  getProviderSettings,
  getProviders,
  refreshSender,
  saveProviderSettings,
  testProviderReadiness,
} from '@features/shipping-quotes/api';
import {
  type ProviderSettings,
  type ProviderSettingsInput,
  providerSettingsInput,
} from '@features/shipping-quotes/provider-admin-schemas';
import { publishedWeightLimits } from '@features/shipping-quotes/provider-weight-policy';
import { QuoteDecimal } from '@features/shipping-quotes/quote-decimal';
import type { Provider } from '@features/shipping-quotes/schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { businessTimestamp } from '@lib/dates';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

function ProviderSettingsForm({
  provider,
  cachedDefault,
}: {
  provider: ProviderSettings;
  cachedDefault?: Provider['cachedDefault'];
}) {
  const { session } = useSession();
  const queries = useQueryClient();
  const [testId, setTestId] = useState<string>();
  const [now, setNow] = useState(() => dayjs());
  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(timer);
  }, []);
  const { register, watch, setValue, handleSubmit, formState } = useForm<ProviderSettingsInput>({
    resolver: zodResolver(providerSettingsInput),
    defaultValues: {
      revision: provider.revision,
      enabled: provider.enabled,
      executionMode: provider.executionMode,
      maintenanceMessage: provider.maintenanceMessage ?? '',
      staleHours: provider.staleHours,
      maxPackageWeightLb: new QuoteDecimal(
        provider.maxPackageWeightLb ?? publishedWeightLimits[provider.code],
      ).toString(),
      acknowledgeFailure: false,
    },
  });
  const mode = watch('executionMode');
  const maxWeight = watch('maxPackageWeightLb');
  const abovePublished =
    providerSettingsInput.shape.maxPackageWeightLb.safeParse(maxWeight).success &&
    new QuoteDecimal(maxWeight).gt(publishedWeightLimits[provider.code]);
  const result = useQuery({
    queryKey: ['provider-readiness', provider.code, testId],
    enabled: !!testId,
    queryFn: ({ signal }) =>
      getProviderReadiness(session.client, provider.code, testId ?? '', signal),
    refetchInterval: (query) =>
      ['queued', 'running'].includes(query.state.data?.state ?? 'queued') ? 1000 : false,
  });
  const test = useMutation({
    mutationFn: () => testProviderReadiness(session.client, provider.code, mode),
    onSuccess: (data) => {
      queries.setQueryData(['provider-readiness', provider.code, data.id], data);
      setTestId(data.id);
    },
  });
  const save = useMutation({
    mutationFn: (input: ProviderSettingsInput) =>
      saveProviderSettings(session.client, provider.code, input),
    onSuccess: async (data) => {
      queries.setQueryData(['provider-settings'], data);
      await queries.invalidateQueries({ queryKey: ['quote-providers'] });
      await queries.invalidateQueries({ queryKey: ['quote-comparison'] });
      await queries.invalidateQueries({ queryKey: ['quote-comparisons'] });
    },
  });
  const defaultRefresh = useMutation({
    mutationFn: () => refreshSender(session.client, provider.code),
    onSuccess: () => queries.invalidateQueries({ queryKey: ['quote-providers'] }),
  });
  const displayedDefault =
    provider.code === 'amazon' ? undefined : (defaultRefresh.data ?? cachedDefault);
  const defaultCurrent =
    defaultRefresh.data?.expiresAt && now.isBefore(dayjs(defaultRefresh.data.expiresAt));
  const current = result.data;
  const valid =
    !!current &&
    current.executionMode === mode &&
    !!current.expiresAt &&
    now.isBefore(dayjs(current.expiresAt));
  const pending =
    test.isPending || (!!testId && (!current || ['queued', 'running'].includes(current.state)));
  const failed = current?.state === 'failed';
  const canSave =
    mode === provider.executionMode ||
    (valid && (current?.state === 'succeeded' || (failed && watch('acknowledgeFailure'))));
  const modes = provider.code === 'amazon' ? (['api'] as const) : (['request', 'browser'] as const);
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box
        component="form"
        onSubmit={handleSubmit((data) =>
          save.mutate({ ...data, connectionTestId: valid ? current?.id : undefined }),
        )}
        noValidate
      >
        <Stack spacing={2}>
          <Typography variant="h6">{provider.name}</Typography>
          {displayedDefault && (
            <Alert severity={defaultCurrent && !defaultRefresh.isError ? 'success' : 'warning'}>
              {Object.values(displayedDefault.address).filter(Boolean).join(', ')} — Retrieved{' '}
              {businessTimestamp(displayedDefault.retrievedAt)} ET.
              {(!defaultCurrent || defaultRefresh.isError) &&
                ' Cached default — refresh to verify.'}
            </Alert>
          )}
          {provider.code !== 'amazon' && defaultRefresh.error && (
            <Alert severity="warning">{safeError(defaultRefresh.error).message}</Alert>
          )}
          {provider.code !== 'amazon' && (
            <Button
              disabled={!provider.enabled || defaultRefresh.isPending || pending}
              onClick={() => defaultRefresh.mutate()}
            >
              {defaultRefresh.isPending
                ? 'Refreshing default…'
                : `Refresh ${provider.name} default`}
            </Button>
          )}
          {provider.code === 'amazon' && (
            <Alert severity="warning">
              Sandbox mode — test data only, not live commercial Amazon prices.
            </Alert>
          )}
          {!provider.enabled && (
            <Typography variant="body2">
              {provider.code === 'amazon'
                ? 'Enable this provider to include it in quote comparisons. Readiness testing remains available while disabled.'
                : 'Enable this provider to refresh its default. Readiness testing remains available while disabled.'}
            </Typography>
          )}
          <FormControlLabel
            control={<Checkbox {...register('enabled')} checked={watch('enabled')} />}
            label="Provider enabled"
          />
          <TextField
            select
            label="Execution mode"
            value={mode}
            {...register('executionMode')}
            onChange={(event) => {
              setValue(
                'executionMode',
                event.target.value as ProviderSettingsInput['executionMode'],
              );
              setValue('acknowledgeFailure', false);
              setTestId(undefined);
              test.reset();
            }}
            disabled={pending || save.isPending}
          >
            {modes.map((value) => (
              <MenuItem value={value} key={value}>
                {value === 'api' ? 'API' : value === 'request' ? 'Request' : 'Browser'}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Maintenance message"
            {...register('maintenanceMessage')}
            error={!!formState.errors.maintenanceMessage}
            helperText="Visible to staff; maximum 500 characters."
          />
          <TextField
            label="Maximum weight per box (lb)"
            {...register('maxPackageWeightLb')}
            error={!!formState.errors.maxPackageWeightLb}
            helperText={
              formState.errors.maxPackageWeightLb?.message ??
              'Actual packed weight per box. Applies to new requests and retries.'
            }
          />
          {abovePublished && (
            <Alert severity="warning">
              Above the published {publishedWeightLimits[provider.code]} lb limit. Changing this
              setting does not guarantee provider acceptance.
            </Alert>
          )}
          <TextField
            label="Stale period (hours)"
            type="number"
            {...register('staleHours', { valueAsNumber: true })}
            error={!!formState.errors.staleHours}
            helperText="1–168 whole hours; default 1 hour. Applies to existing quotes without provider expiry."
          />
          <Button
            disabled={pending || save.isPending}
            onClick={() => {
              setValue('acknowledgeFailure', false);
              test.mutate();
            }}
          >
            Test {mode} readiness
          </Button>
          <Typography variant="body2">
            {provider.code === 'amazon'
              ? 'Checks sandbox API authentication. Does not request a sample rate.'
              : 'Checks login, account defaults, and quote readiness. Does not request a sample rate.'}
          </Typography>
          {pending && <Alert severity="info">Connection test pending…</Alert>}
          {(test.error || result.error || save.error) && (
            <Alert severity="error">
              {safeError(test.error || result.error || save.error).message}
            </Alert>
          )}
          {current && !pending && (
            <Alert severity={failed || !valid ? 'warning' : 'success'}>
              {valid
                ? failed
                  ? 'Connection test failed. Saving this mode may cause quotes to fail.'
                  : 'Readiness check passed.'
                : 'Connection test expired. Run it again before changing mode.'}
              {current.completedAt && <> Tested {businessTimestamp(current.completedAt)} ET.</>}
              {current.failureSummary === 'readiness_timeout' && ' The check timed out.'}
            </Alert>
          )}
          {failed && valid && mode !== provider.executionMode && (
            <FormControlLabel
              control={
                <Checkbox
                  {...register('acknowledgeFailure')}
                  checked={watch('acknowledgeFailure')}
                />
              }
              label="I acknowledge the failed test and want to save this mode"
            />
          )}
          {provider.savedConnectionTest?.state === 'failed' && (
            <Alert severity="warning">
              This configuration was saved after a failed readiness test. Tested{' '}
              {businessTimestamp(
                provider.savedConnectionTest.completedAt ?? provider.savedConnectionTest.createdAt,
              )}{' '}
              ET; admin {provider.savedConnectionTest.testedBy}.
            </Alert>
          )}
          <Typography variant="caption">
            Updated {businessTimestamp(provider.updatedAt)} ET
            {provider.updatedBy ? ` by admin ${provider.updatedBy}` : ''}.
          </Typography>
          <Button
            type="submit"
            variant="contained"
            disabled={!canSave || pending || save.isPending}
          >
            Save {provider.name} settings
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}

export function ProviderSettingsPage() {
  const { session, account, status } = useSession();
  const allowed = status === 'authenticated' && account?.role === 'admin';
  const query = useQuery({
    queryKey: ['provider-settings'],
    queryFn: ({ signal }) => getProviderSettings(session.client, signal),
    enabled: allowed,
    retry: false,
  });
  const providers = useQuery({
    queryKey: ['quote-providers'],
    queryFn: ({ signal }) => getProviders(session.client, signal),
    enabled: allowed,
  });
  if (!allowed) return <Alert severity="error">Administrator access required.</Alert>;
  return (
    <Stack spacing={3}>
      <PageHeader title="Quote provider settings" />
      {query.isPending && <Typography>Loading provider settings…</Typography>}
      {query.error && (
        <Alert
          severity="error"
          action={<Button onClick={() => void query.refetch()}>Reload</Button>}
        >
          {safeError(query.error).message}
        </Alert>
      )}
      {query.data?.map((provider) => (
        <ProviderSettingsForm
          key={`${provider.code}:${provider.revision}`}
          provider={provider}
          cachedDefault={providers.data?.find((p) => p.code === provider.code)?.cachedDefault}
        />
      ))}
    </Stack>
  );
}
