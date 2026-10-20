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
import dayjs from 'dayjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useFieldArray, useForm, useFormContext } from 'react-hook-form';
import { v4 as randomUUID } from 'uuid';
import { QuoteDecimal } from './quote-decimal';
import { addressCountries, isSupportedCountryCode, regionsForCountry } from './quote-standards';
import {
  type Address,
  createQuoteFormSchema,
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
  const { register, setValue, watch } = useFormContext<QuoteInput>();
  const countryPath = `${prefix}.country` as const;
  const divisionPath = `${prefix}.division` as const;
  const country = watch(countryPath);
  const division = watch(divisionPath);
  const regions = regionsForCountry(country);
  const countryRegistration = register(countryPath);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
      {(['name', 'street', 'street2', 'city'] as const).map((field) => (
        <TextField key={field} label={`${label} ${field}`} {...register(`${prefix}.${field}`)} />
      ))}
      <TextField
        select
        label={`${label} country`}
        value={country}
        disabled={origin}
        {...countryRegistration}
        onChange={(event) => {
          void countryRegistration.onChange(event);
          setValue(divisionPath, '', { shouldDirty: true, shouldValidate: true });
        }}
      >
        {addressCountries.map(([name, code]) => (
          <MenuItem key={code} value={code}>
            {name}
          </MenuItem>
        ))}
      </TextField>
      {regions.length ? (
        <TextField
          select
          label={`${label} state / province`}
          value={division}
          {...register(divisionPath)}
        >
          {division && !regions.some(([, code]) => code === division) && (
            <MenuItem value={division}>
              {regions.find(([name]) => name === division)?.[0] ?? division}
            </MenuItem>
          )}
          {regions.map(([name, code]) => (
            <MenuItem key={code} value={code}>
              {name}
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <TextField label={`${label} state / province`} {...register(divisionPath)} />
      )}
      <TextField label={`${label} postalCode`} {...register(`${prefix}.postalCode`)} />
    </Box>
  );
}
function UnishippersContactFields({
  prefix,
  label,
}: {
  prefix: 'destination' | `providers.${number}.sender.address`;
  label: string;
}) {
  const { register, getFieldState, formState } = useFormContext<QuoteInput>();
  const nameError = getFieldState(`${prefix}.contactName`, formState).error;
  const phoneError = getFieldState(`${prefix}.phone`, formState).error;
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
      <TextField
        label={`${label} contact name`}
        error={Boolean(nameError)}
        helperText={
          nameError
            ? 'Contact name must be at most 100 characters.'
            : 'Required for myUnishippers full-form browser quotes.'
        }
        {...register(`${prefix}.contactName`)}
      />
      <TextField
        label={`${label} phone number`}
        type="tel"
        error={Boolean(phoneError)}
        helperText={
          phoneError
            ? 'Enter a possible phone number for the address country.'
            : 'National or international formatting is accepted.'
        }
        {...register(`${prefix}.phone`)}
      />
    </Box>
  );
}
function CustomsFields({ index }: { index: number }) {
  const { register, control, watch } = useFormContext<QuoteInput>();
  const items = useFieldArray({ control, name: `packageGroups.${index}.customsItems` });
  const currency = watch('international.totalValue.currency') || 'USD';
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
            ).map((field) => {
              const input = (
                <TextField
                  key={field}
                  select={field === 'countryOfManufacture'}
                  label={`Group ${index + 1} item ${j + 1} ${field}`}
                  slotProps={field === 'currency' ? { htmlInput: { readOnly: true } } : undefined}
                  {...register(
                    `packageGroups.${index}.customsItems.${j}.${field}`,
                    field === 'quantity' ? { valueAsNumber: true } : {},
                  )}
                >
                  {field === 'countryOfManufacture' &&
                    addressCountries.map(([name, code]) => (
                      <MenuItem key={code} value={code}>
                        {name}
                      </MenuItem>
                    ))}
                </TextField>
              );

              return input;
            })}
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
            currency,
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
  configuration,
  totalBoxes,
  onRefresh,
}: {
  index: number;
  configuration: Provider;
  totalBoxes: number;
  onRefresh: (code: ProviderCode) => Promise<SenderRefresh>;
}) {
  const name = configuration.name;
  const { register, watch, setValue, getValues } = useFormContext<QuoteInput>();
  const provider = watch(`providers.${index}`);
  const [refreshed, setRefreshed] = useState<SenderRefresh>();
  const [failure, setFailure] = useState('');
  const [pending, setPending] = useState(false);
  const [refreshNumber, setRefreshNumber] = useState(0);
  const [expired, setExpired] = useState(false);
  const generation = useRef(0);
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshNumber is the explicit user-requested refresh trigger.
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
        setExpired(false);
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
  }, [provider.code, provider.sender.mode, index, setValue, refreshNumber]);
  useEffect(() => {
    if (!refreshed || provider.sender.mode !== 'account_default') return;
    const expires = refreshed.expiresAt
      ? dayjs(refreshed.expiresAt)
      : dayjs(refreshed.retrievedAt).add(15, 'minute');
    const timer = setTimeout(
      () => {
        setExpired(true);
        setValue(`providers.${index}.sender`, { mode: 'account_default', refreshId: '' });
      },
      Math.max(0, expires.diff(dayjs())),
    );
    return () => clearTimeout(timer);
  }, [refreshed, provider.sender.mode, index, setValue]);
  const displayed = refreshed ?? configuration.cachedDefault;
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h6">{name}</Typography>
        <Typography variant="body2">
          Mode: {configuration.executionMode}. Stale period: {configuration.staleHours ?? 1}{' '}
          hour(s).
        </Typography>
        {configuration.maintenanceMessage && (
          <Alert severity="info">{configuration.maintenanceMessage}</Alert>
        )}
        {provider.code === 'unishippers' && (
          <Alert severity="info">
            All package groups are quoted together, and returned totals already include box
            quantities. Browser quotes use the full myUnishippers form and require receiver contact
            details. A sender correction applies only to this comparison and does not update the
            provider account. Company names must be at most 35 characters for browser quotes.
          </Alert>
        )}
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
                    address: { ...(displayed?.address ?? emptyAddress()), country: 'US' },
                  }
                : { mode: 'account_default', refreshId: randomUUID() },
            )
          }
        >
          <MenuItem value="account_default">Account default</MenuItem>
          <MenuItem value="explicit">Explicit sender</MenuItem>
        </TextField>
        {provider.sender.mode === 'explicit' ? (
          <>
            <AddressFields
              prefix={`providers.${index}.sender.address`}
              label={`${name} origin`}
              origin
            />
            {provider.code === 'unishippers' && (
              <UnishippersContactFields
                prefix={`providers.${index}.sender.address`}
                label="myUnishippers origin"
              />
            )}
          </>
        ) : (
          <>
            {pending && <Alert severity="info">Refreshing sender…</Alert>}
            {failure && <Alert severity="warning">{failure}</Alert>}
            {displayed && (
              <Alert severity={pending || failure || expired || !refreshed ? 'warning' : 'success'}>
                {Object.values(displayed.address).filter(Boolean).join(', ')} — Retrieved{' '}
                {businessTimestamp(displayed.retrievedAt)} ET.
                {(pending || failure || expired || !refreshed) &&
                  ' Stale default — refresh or enter an explicit sender before saving.'}
              </Alert>
            )}
            <Button disabled={pending} onClick={() => setRefreshNumber((n) => n + 1)}>
              Refresh {name} default
            </Button>
          </>
        )}
        {configuration.supportsSignature && (
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
        )}
        {configuration.supportsInsurance && (
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
        )}
        {configuration.supportsInsurance && provider.options.insurance && (
          <>
            <TextField
              label={`${name} insured value per box`}
              {...register(`providers.${index}.options.insurance.amount`)}
            />
            <TextField
              label={`${name} insurance currency`}
              defaultValue={getValues(`providers.${index}.options.insurance.currency`)}
              slotProps={{ htmlInput: { readOnly: true } }}
              {...register(`providers.${index}.options.insurance.currency`)}
            />
            {/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(provider.options.insurance.amount) && (
              <Typography variant="body2">
                Aggregate requested coverage:{' '}
                {new QuoteDecimal(provider.options.insurance.amount).times(totalBoxes).toFixed(2)}{' '}
                {provider.options.insurance.currency}
              </Typography>
            )}
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
  const formSchema = useMemo(() => createQuoteFormSchema(providers), [providers]);
  const form = useForm<QuoteInput>({
    resolver: zodResolver(formSchema),
    defaultValues: initial ?? {
      idempotencyKey: randomUUID(),
      shipDate: businessCalendarDate(),
      destination: emptyAddress(),
      providers: providers
        .filter((p) => p.enabled)
        .map((p) => ({
          code: p.code,
          sender: { mode: 'account_default', refreshId: randomUUID() },
          options: { signature: 'none', insurance: null },
        })),
      packageGroups: [emptyGroup()],
    },
  });
  const { register, control, watch, setValue, handleSubmit, formState } = form;
  const groups = useFieldArray({ control, name: 'packageGroups' });
  const selected = watch('providers');
  const country = watch('destination.country');
  const packageGroups = watch('packageGroups');
  const international = watch('international');
  const isInternational = isSupportedCountryCode(country) && country !== 'US';
  const totalBoxes = packageGroups.reduce((sum, group) => sum + (group.quantity || 0), 0);
  const detailedCustomsTotal = useMemo(() => {
    if (international?.customsMode !== 'detailed') return '';
    try {
      let total = new QuoteDecimal(0);
      for (const group of packageGroups)
        for (const item of group.customsItems) {
          if (!item.unitValue || !item.quantity || !group.quantity) return '';
          total = total.add(
            new QuoteDecimal(item.unitValue).times(item.quantity).times(group.quantity),
          );
        }
      return total.isPositive() ? total.toFixed(6) : '';
    } catch {
      return '';
    }
  }, [international?.customsMode, packageGroups]);
  useEffect(() => {
    if (!isSupportedCountryCode(country)) return;
    if (country === 'US') {
      if (form.getValues('international')) setValue('international', undefined);
      for (const [index, group] of form.getValues('packageGroups').entries())
        if (group.customsItems.length) setValue(`packageGroups.${index}.customsItems`, []);
      return;
    }
    if (!form.getValues('international'))
      setValue('international', {
        contentsDescription: '',
        customsMode: 'summary',
        totalValue: { amount: '', currency: 'USD' },
      });
    const eligible = form
      .getValues('providers')
      .filter(
        (provider) =>
          providers.find((configuration) => configuration.code === provider.code)
            ?.internationalAvailable,
      );
    if (eligible.length !== form.getValues('providers').length) setValue('providers', eligible);
  }, [country, form, providers, setValue]);
  useEffect(() => {
    if (international?.customsMode === 'detailed')
      setValue('international.totalValue.amount', detailedCustomsTotal, {
        shouldValidate: true,
      });
  }, [detailedCustomsTotal, international?.customsMode, setValue]);
  const dimensionsOptional =
    selected.length === 1 &&
    selected[0]?.code === 'unishippers' &&
    providers.find((provider) => provider.code === 'unishippers')?.executionMode === 'request';
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
          ? randomUUID()
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
              Package dimensions must include all three values or none. Blank dimensions require
              myUnishippers request mode as the only selected provider, and weight is always
              required. Country codes use two uppercase letters; currencies use three.
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
                  .map((provider) => {
                    const unavailable = isInternational && !provider.internationalAvailable;
                    return (
                      <Box key={provider.code}>
                        <FormControlLabel
                          label={provider.name}
                          control={
                            <Checkbox
                              disabled={unavailable}
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
                                            refreshId: randomUUID(),
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
                        {unavailable && (
                          <Typography variant="caption" sx={{ display: 'block' }}>
                            {provider.usedInternationally
                              ? 'International quoting is unavailable in the current provider mode'
                              : 'Not available for international destinations'}
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
              </Stack>
              {providers
                .filter((p) => !p.enabled)
                .map((p) => (
                  <Alert severity="warning" key={p.code}>
                    {p.name} is disabled.{' '}
                    {p.maintenanceMessage || 'Unavailable for new comparisons.'}
                  </Alert>
                ))}
              {!providers.some((p) => p.enabled) && (
                <Alert severity="warning">No providers are enabled. Saving is unavailable.</Alert>
              )}
              {selected.map((p, index) => {
                const configuration = providers.find((x) => x.code === p.code);
                return configuration ? (
                  <ProviderFields
                    key={p.code}
                    index={index}
                    configuration={configuration}
                    totalBoxes={totalBoxes}
                    onRefresh={onRefresh}
                  />
                ) : null;
              })}
              <Typography variant="h6">Destination</Typography>
              <AddressFields prefix="destination" label="Destination" />
              {selected.some((provider) => provider.code === 'unishippers') && (
                <UnishippersContactFields prefix="destination" label="myUnishippers receiver" />
              )}
              {isInternational && international && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    <Typography variant="h6">International shipping details</Typography>
                    <TextField
                      label="Specific description of contents for label"
                      {...register('international.contentsDescription')}
                    />
                    <TextField
                      select
                      label="Customs detail level"
                      value={international.customsMode}
                      onChange={(event) => {
                        const mode = event.target.value as 'summary' | 'detailed';
                        setValue('international.customsMode', mode);
                        if (mode === 'summary')
                          for (const [index, group] of packageGroups.entries())
                            if (group.customsItems.length)
                              setValue(`packageGroups.${index}.customsItems`, []);
                      }}
                    >
                      <MenuItem value="summary">Shipment summary</MenuItem>
                      <MenuItem value="detailed">Detailed items per box</MenuItem>
                    </TextField>
                    <TextField
                      label="Total customs value"
                      slotProps={{
                        htmlInput: {
                          readOnly: international.customsMode === 'detailed',
                        },
                      }}
                      helperText={
                        international.customsMode === 'detailed'
                          ? 'Calculated as item quantity × unit value × boxes in each group.'
                          : undefined
                      }
                      {...register('international.totalValue.amount')}
                    />
                    <TextField
                      label="Customs currency"
                      helperText="myUnishippers international browser quoting is verified for USD. Other currencies are saved as unsupported."
                      {...register('international.totalValue.currency')}
                    />
                  </Stack>
                </Paper>
              )}
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
                    {dimensionsOptional && (
                      <Typography variant="body2" color="text.secondary">
                        For myUnishippers request quotes, enter all three dimensions or leave all
                        three dimensions blank. Weight is always required.
                      </Typography>
                    )}
                    {international?.customsMode === 'detailed' && <CustomsFields index={index} />}
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
