import { safeError } from '@api/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { businessCalendarDate, businessTimestamp } from '@lib/dates';
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
import { useEffect, useRef, useState } from 'react';
import { FormProvider, useFieldArray, useForm, useFormContext } from 'react-hook-form';
import {
  type Address,
  createQuoteSchema,
  type Provider,
  type ProviderCode,
  type QuoteInput,
  type SenderRefresh,
} from './schemas';

const emptyAddress = (): Address => ({
  name: '',
  street: '',
  city: '',
  division: '',
  postalCode: '',
  country: 'US',
});
const emptyGroup = (): QuoteInput['packageGroups'][number] => ({
  quantity: 1,
  units: 'imperial',
  length: '',
  width: '',
  height: '',
  weight: '',
  customsItems: [],
});
function AddressFields({
  prefix,
  label,
  origin = false,
}: {
  prefix: 'destination' | `providers.${number}.sender.address`;
  label: string;
  origin?: boolean;
}) {
  const { register } = useFormContext<QuoteInput>();
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
      {(['name', 'street', 'street2', 'city', 'division', 'postalCode', 'country'] as const).map(
        (field) => (
          <TextField
            key={field}
            label={`${label} ${field === 'division' ? 'state / province' : field}`}
            {...register(`${prefix}.${field}`)}
            disabled={origin && field === 'country'}
          />
        ),
      )}
    </Box>
  );
}
function CustomsFields({ index }: { index: number }) {
  const { register, control } = useFormContext<QuoteInput>();
  const items = useFieldArray({ control, name: `packageGroups.${index}.customsItems` });
  return (
    <Stack spacing={2}>
      <Typography>Per-box customs items (item weight uses this group’s weight unit)</Typography>
      {items.fields.map((item, j) => (
        <Paper key={item.id} variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            {(
              [
                'description',
                'quantity',
                'unitValue',
                'currency',
                'countryOfManufacture',
                'weight',
                'hsCode',
              ] as const
            ).map((field) => (
              <TextField
                key={field}
                label={`Group ${index + 1} item ${j + 1} ${field}`}
                {...register(
                  `packageGroups.${index}.customsItems.${j}.${field}`,
                  field === 'quantity' ? { valueAsNumber: true } : {},
                )}
              />
            ))}
            <Button onClick={() => items.remove(j)}>Remove item {j + 1}</Button>
          </Stack>
        </Paper>
      ))}
      <Button
        onClick={() =>
          items.append({
            description: '',
            quantity: 1,
            unitValue: '',
            currency: 'USD',
            countryOfManufacture: 'US',
            weight: '',
          })
        }
      >
        Add customs item to group {index + 1}
      </Button>
    </Stack>
  );
}
function ProviderFields({
  index,
  name,
  onRefresh,
}: {
  index: number;
  name: string;
  onRefresh: (code: ProviderCode) => Promise<SenderRefresh>;
}) {
  const { register, watch, setValue, getValues } = useFormContext<QuoteInput>();
  const provider = watch(`providers.${index}`);
  const [refreshed, setRefreshed] = useState<SenderRefresh>();
  const [failure, setFailure] = useState('');
  const [pending, setPending] = useState(false);
  const generation = useRef(0);
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;
  useEffect(() => {
    if (provider.sender.mode !== 'account_default') return;
    const current = ++generation.current;
    setValue(`providers.${index}.sender`, { mode: 'account_default', refreshId: '' });
    setPending(true);
    setFailure('');
    void refresh
      .current(provider.code)
      .then((result) => {
        if (current !== generation.current) return;
        setRefreshed(result);
        setValue(`providers.${index}.sender`, {
          mode: 'account_default',
          refreshId: result.refreshId,
        });
      })
      .catch((error) => {
        if (current === generation.current)
          setFailure(
            safeError(error).message +
              ' Enter an explicit sender or select the default again to retry.',
          );
      })
      .finally(() => {
        if (current === generation.current) setPending(false);
      });
    return () => {
      generation.current++;
    };
  }, [provider.code, provider.sender.mode, index, setValue]);
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h6">{name}</Typography>
        <TextField
          select
          label={`${name} sender`}
          value={provider.sender.mode}
          onChange={(event) =>
            setValue(
              `providers.${index}.sender`,
              event.target.value === 'explicit'
                ? {
                    mode: 'explicit',
                    address: { ...(refreshed?.address ?? emptyAddress()), country: 'US' },
                  }
                : { mode: 'account_default', refreshId: crypto.randomUUID() },
            )
          }
        >
          <MenuItem value="account_default">Account default</MenuItem>
          <MenuItem value="explicit">Explicit sender</MenuItem>
        </TextField>
        {provider.sender.mode === 'explicit' ? (
          <AddressFields
            prefix={`providers.${index}.sender.address`}
            label={`${name} origin`}
            origin
          />
        ) : (
          <>
            {pending && <Alert severity="info">Refreshing sender…</Alert>}
            {failure && <Alert severity="warning">{failure}</Alert>}
            {refreshed && !pending && !failure && (
              <Alert severity="success">
                {Object.values(refreshed.address).filter(Boolean).join(', ')} — Retrieved{' '}
                {businessTimestamp(refreshed.retrievedAt)} ET
              </Alert>
            )}
          </>
        )}
        <TextField
          select
          label={`${name} signature request`}
          {...register(`providers.${index}.options.signature`)}
          defaultValue={provider.options.signature}
        >
          <MenuItem value="none">None</MenuItem>
          <MenuItem value="signature">Signature</MenuItem>
          <MenuItem value="adult_signature">Adult signature</MenuItem>
        </TextField>
        <FormControlLabel
          label={`${name} request insurance`}
          control={
            <Checkbox
              checked={provider.options.insurance !== null}
              onChange={(_, checked) =>
                setValue(
                  `providers.${index}.options.insurance`,
                  checked ? { amount: '', currency: 'USD' } : null,
                )
              }
            />
          }
        />
        {provider.options.insurance && (
          <>
            <TextField
              label={`${name} insurance amount`}
              {...register(`providers.${index}.options.insurance.amount`)}
            />
            <TextField
              label={`${name} insurance currency`}
              defaultValue={getValues(`providers.${index}.options.insurance.currency`)}
              {...register(`providers.${index}.options.insurance.currency`)}
            />
          </>
        )}
      </Stack>
    </Paper>
  );
}
export function QuoteForm({
  providers,
  initial,
  onSave,
  onRefresh,
}: {
  providers: Provider[];
  initial?: QuoteInput;
  onSave: (input: QuoteInput) => Promise<unknown>;
  onRefresh: (code: ProviderCode) => Promise<SenderRefresh>;
}) {
  const form = useForm<QuoteInput>({
    resolver: zodResolver(createQuoteSchema),
    defaultValues: initial ?? {
      idempotencyKey: crypto.randomUUID(),
      shipDate: businessCalendarDate(),
      destination: emptyAddress(),
      providers: providers
        .filter((p) => p.enabled)
        .map((p) => ({
          code: p.code,
          sender: { mode: 'account_default', refreshId: crypto.randomUUID() },
          options: { signature: 'none', insurance: null },
        })),
      packageGroups: [emptyGroup()],
    },
  });
  const { register, control, watch, setValue, handleSubmit, formState } = form;
  const groups = useFieldArray({ control, name: 'packageGroups' });
  const selected = watch('providers');
  const country = watch('destination.country');
  const [failure, setFailure] = useState('');
  const lastSubmission = useRef<{ body: string; key: string } | undefined>(undefined);
  const submit = handleSubmit(async (input) => {
    setFailure('');
    const { idempotencyKey, ...values } = input;
    const body = JSON.stringify(values);
    const key =
      lastSubmission.current?.body === body
        ? lastSubmission.current.key
        : lastSubmission.current
          ? crypto.randomUUID()
          : idempotencyKey;
    lastSubmission.current = { body, key };
    setValue('idempotencyKey', key);
    try {
      await onSave({ ...input, idempotencyKey: key });
    } catch (error) {
      setFailure(safeError(error).message);
    }
  });
  return (
    <FormProvider {...form}>
      <Box component="form" onSubmit={submit} noValidate>
        <Stack spacing={3}>
          <Alert severity="warning">
            Saving queues provider comparisons. Results appear as each provider finishes; requested
            coverage is not confirmed until a result says so.
          </Alert>
          {failure && <Alert severity="error">{failure}</Alert>}
          {Object.keys(formState.errors).length > 0 && (
            <Alert severity="error">
              Check required addresses, ship date, positive package values, and customs items.
              Country codes use two uppercase letters; currencies use three.
            </Alert>
          )}
          <Box
            component="fieldset"
            disabled={formState.isSubmitting}
            sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
          >
            <Stack spacing={3}>
              <TextField
                label="Ship date"
                type="date"
                slotProps={{ inputLabel: { shrink: true } }}
                {...register('shipDate')}
              />
              <Stack direction="row" sx={{ flexWrap: 'wrap' }}>
                {providers
                  .filter((p) => p.enabled)
                  .map((provider) => (
                    <FormControlLabel
                      key={provider.code}
                      label={provider.name}
                      control={
                        <Checkbox
                          checked={selected.some((p) => p.code === provider.code)}
                          onChange={(_, checked) =>
                            setValue(
                              'providers',
                              checked
                                ? [
                                    ...selected,
                                    {
                                      code: provider.code,
                                      sender: {
                                        mode: 'account_default',
                                        refreshId: crypto.randomUUID(),
                                      },
                                      options: { signature: 'none', insurance: null },
                                    },
                                  ]
                                : selected.filter((p) => p.code !== provider.code),
                            )
                          }
                        />
                      }
                    />
                  ))}
              </Stack>
              {!providers.some((p) => p.enabled) && (
                <Alert severity="warning">No providers are enabled. Saving is unavailable.</Alert>
              )}
              {selected.map((p, index) => (
                <ProviderFields
                  key={p.code}
                  index={index}
                  name={providers.find((x) => x.code === p.code)?.name ?? p.code}
                  onRefresh={onRefresh}
                />
              ))}
              <Typography variant="h6">Destination</Typography>
              <AddressFields prefix="destination" label="Destination" />
              {groups.fields.map((group, index) => (
                <Paper variant="outlined" key={group.id} sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    <Typography variant="h6">Package group {index + 1}</Typography>
                    <TextField
                      label={`Group ${index + 1} quantity`}
                      type="number"
                      {...register(`packageGroups.${index}.quantity`, { valueAsNumber: true })}
                    />
                    <TextField
                      select
                      label={`Group ${index + 1} units`}
                      defaultValue={group.units}
                      {...register(`packageGroups.${index}.units`)}
                    >
                      <MenuItem value="imperial">Inches / pounds</MenuItem>
                      <MenuItem value="metric">Centimeters / kilograms</MenuItem>
                    </TextField>
                    {(['length', 'width', 'height', 'weight'] as const).map((field) => (
                      <TextField
                        key={field}
                        label={`Group ${index + 1} ${field}`}
                        {...register(`packageGroups.${index}.${field}`)}
                      />
                    ))}
                    {(country !== 'US' || group.customsItems.length > 0) && (
                      <CustomsFields index={index} />
                    )}
                    <Button
                      disabled={groups.fields.length === 1}
                      onClick={() => groups.remove(index)}
                    >
                      Remove package group {index + 1}
                    </Button>
                  </Stack>
                </Paper>
              ))}
              <Button onClick={() => groups.append(emptyGroup())}>Add package group</Button>
              <Button
                type="submit"
                variant="contained"
                disabled={
                  !providers.some((p) => p.enabled) ||
                  formState.isSubmitting ||
                  selected.some((p) => p.sender.mode === 'account_default' && !p.sender.refreshId)
                }
              >
                Save comparison
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Box>
    </FormProvider>
  );
}
