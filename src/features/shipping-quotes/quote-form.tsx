import { safeError } from '@api/api';
import { useNotifications } from '@components/feedback/notification-provider';
import { zodResolver } from '@hookform/resolvers/zod';
import { businessCalendarDate } from '@lib/dates';
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
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type FieldPath,
  FormProvider,
  type UseFormReturn,
  useFieldArray,
  useForm,
  useFormContext,
} from 'react-hook-form';
import { v4 as randomUUID } from 'uuid';
import { QuoteDecimal } from './quote-decimal';
import { addressCountries, isSupportedCountryCode, regionsForCountry } from './quote-standards';
import { type Address, createQuoteFormSchema, type Provider, type QuoteInput } from './schemas';

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
// Connect MUI's actual input (including selects) to React Hook Form for focus and errors.
function quoteField(
  form: UseFormReturn<QuoteInput>,
  name: FieldPath<QuoteInput>,
  hint?: string,
  numeric = false,
) {
  const { ref, ...registration } = form.register(name, numeric ? { valueAsNumber: true } : {});
  const { error } = form.getFieldState(name, form.formState);
  return {
    ...registration,
    inputRef: ref,
    id: `quote-${name}`,
    error: Boolean(error),
    helperText: error?.message ?? hint,
  };
}

function AddressFields({
  prefix,
  label,
  origin = false,
}: {
  prefix: 'destination' | `providers.${number}.sender.address`;
  label: string;
  origin?: boolean;
}) {
  const form = useFormContext<QuoteInput>();
  const { setValue, watch } = form;
  const countryPath = `${prefix}.country` as const;
  const divisionPath = `${prefix}.division` as const;
  const country = watch(countryPath);
  const division = watch(divisionPath);
  const regions = regionsForCountry(country);
  const countryRegistration = quoteField(form, countryPath);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
      {(['name', 'street', 'street2', 'city'] as const).map((field) => (
        <TextField
          key={field}
          required={field !== 'street2'}
          label={`${label} ${{ name: 'company or name', street: 'address', street2: 'apartment / suite (optional)', city: 'city' }[field]}`}
          {...quoteField(form, `${prefix}.${field}`)}
        />
      ))}
      <TextField
        select
        required
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
          {...quoteField(form, divisionPath, 'State or province, if applicable')}
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
        <TextField
          label={`${label} state / province`}
          {...quoteField(form, divisionPath, 'State or province, if applicable')}
        />
      )}
      <TextField
        required
        label={`${label} ZIP / postal code`}
        {...quoteField(form, `${prefix}.postalCode`)}
      />
      <TextField
        label={`${label} contact name (optional)`}
        {...quoteField(form, `${prefix}.contactName`)}
      />
      <TextField
        label={`${label} phone (optional)`}
        {...quoteField(
          form,
          `${prefix}.phone`,
          'Include the country code, for example +1 202 555 0147',
        )}
      />
    </Box>
  );
}
function CustomsFields({ index }: { index: number }) {
  const form = useFormContext<QuoteInput>();
  const { control, watch } = form;
  const items = useFieldArray({ control, name: `packageGroups.${index}.customsItems` });
  const currency = watch('international.totalValue.currency') || 'USD';
  return (
    <Stack spacing={2}>
      <Typography>
        List the items inside one box. Use the same weight unit selected for the box.
      </Typography>
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
                  defaultValue={
                    field === 'countryOfManufacture' ? item.countryOfManufacture : undefined
                  }
                  required={field !== 'hsCode'}
                  label={`Box type ${index + 1}, item ${j + 1}: ${{ description: 'description', quantity: 'number of items', unitValue: 'value per item', currency: 'currency', countryOfManufacture: 'made in', weight: 'weight per item', hsCode: 'HS tariff code (optional)' }[field]}`}
                  slotProps={field === 'currency' ? { htmlInput: { readOnly: true } } : undefined}
                  {...quoteField(
                    form,
                    `packageGroups.${index}.customsItems.${j}.${field}`,
                    undefined,
                    field === 'quantity',
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
        Add an item to box type {index + 1}
      </Button>
    </Stack>
  );
}
function ProviderFields({
  index,
  configuration,
  totalBoxes,
}: {
  index: number;
  configuration: Provider;
  totalBoxes: number;
}) {
  const name = configuration.name;
  const form = useFormContext<QuoteInput>();
  const { watch, setValue, getValues } = form;
  const provider = watch(`providers.${index}`);
  if (provider.sender.mode !== 'explicit')
    return (
      <Alert severity="error">
        Enter a sender address for {name}: deselect this service and select it again to fill in the
        address.
      </Alert>
    );

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h6">{name}</Typography>
        {configuration.maintenanceMessage && (
          <Alert severity="info">{configuration.maintenanceMessage}</Alert>
        )}
        {provider.code === 'unishippers' && (
          <Alert severity="info">
            For shipping within the US today. We estimate the total by multiplying each box price by
            the number of identical boxes. Signature and insurance are unavailable. Box sizes are
            optional only when comparing myUnishippers alone; weight is required.
          </Alert>
        )}
        <Typography variant="body2">
          Where are you shipping from? Enter the pickup address for this service.
        </Typography>
        <AddressFields
          prefix={`providers.${index}.sender.address`}
          label={`${name} sender`}
          origin
        />
        {configuration.supportsSignature && (
          <TextField
            select
            label={`${name} signature request`}
            {...quoteField(form, `providers.${index}.options.signature`)}
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
              required
              {...quoteField(form, `providers.${index}.options.insurance.amount`)}
            />
            <TextField
              label={`${name} insurance currency`}
              defaultValue={getValues(`providers.${index}.options.insurance.currency`)}
              slotProps={{ htmlInput: { readOnly: true } }}
              {...quoteField(form, `providers.${index}.options.insurance.currency`)}
            />
            {/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(provider.options.insurance.amount) && (
              <Typography variant="body2">
                Total requested insurance:{' '}
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
}: {
  providers: Provider[];
  initial?: QuoteInput;
  onSave: (input: QuoteInput) => Promise<unknown>;
}) {
  const formSchema = useMemo(() => createQuoteFormSchema(providers), [providers]);
  const defaultValues: QuoteInput = initial ?? {
    idempotencyKey: randomUUID(),
    shipDate: businessCalendarDate(),
    destination: emptyAddress(),
    providers: providers
      .filter((p) => p.enabled)
      .map((p) => ({
        code: p.code,
        sender: {
          mode: 'explicit',
          address: { ...emptyAddress(), country: 'US' as const },
        },
        options: { signature: 'none', insurance: null },
      })),
    packageGroups: [emptyGroup()],
  };
  const form = useForm<QuoteInput>({
    resolver: zodResolver(formSchema),
    defaultValues,
    shouldFocusError: false,
  });
  const { control, watch, setValue, handleSubmit, formState } = form;
  const { showNotification } = useNotifications();
  const formElement = useRef<HTMLFormElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const focusedSubmission = useRef(0);
  useEffect(() => {
    if (formState.submitCount === focusedSubmission.current) return;
    focusedSubmission.current = formState.submitCount;
    if (!Object.keys(formState.errors).length) return;
    const field = formElement.current?.querySelector<HTMLElement>(
      'input[aria-invalid="true"], [role="combobox"][aria-invalid="true"], textarea[aria-invalid="true"]',
    );
    const target = field ?? errorSummary.current;
    target?.focus();
    target?.scrollIntoView?.({ block: 'center', behavior: 'instant' });
  }, [formState.submitCount, formState.errors]);
  const groups = useFieldArray({ control, name: 'packageGroups' });
  const selected = watch('providers');
  const dimensionsOptional = selected.length === 1 && selected[0]?.code === 'unishippers';
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
  const [failure, setFailure] = useState('');
  const lastSubmission = useRef<{ body: string; key: string } | undefined>(undefined);
  const submit = handleSubmit(
    async (input) => {
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
        const message = safeError(error).message;
        setFailure(message);
        showNotification({ severity: 'error', message });
      }
    },
    () => {
      setFailure('');
      showNotification({
        severity: 'error',
        message: 'Please complete or correct the highlighted fields before comparing quotes.',
      });
    },
  );
  return (
    <FormProvider {...form}>
      <Box
        component="form"
        ref={formElement}
        onSubmit={submit}
        noValidate
        sx={{ pb: { xs: 12, sm: 0 } }}
      >
        <Stack spacing={3}>
          <Alert severity="info">
            Fill in the shipping addresses and box details, then choose Compare quotes to see
            prices. This does not book a shipment. Fields marked * are required.
          </Alert>
          {failure && <Alert severity="error">{failure}</Alert>}
          {Object.keys(formState.errors).length > 0 && (
            <Alert severity="error" ref={errorSummary} tabIndex={-1}>
              Please check the highlighted fields below. Your entries have been kept.
            </Alert>
          )}
          <Box
            component="fieldset"
            disabled={formState.isSubmitting}
            sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
          >
            <Stack spacing={3}>
              <Typography variant="h6">1. Choose your shipping services</Typography>
              <TextField
                required
                label="Ship date"
                type="date"
                slotProps={{ inputLabel: { shrink: true } }}
                {...quoteField(
                  form,
                  'shipDate',
                  selected.some((p) => p.code === 'unishippers')
                    ? 'myUnishippers quotes are available for today only (Eastern Time).'
                    : 'Choose today or a future date. Dates use Eastern Time.',
                )}
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
                                            mode: 'explicit',
                                            address: {
                                              ...emptyAddress(),
                                              country: 'US' as const,
                                            },
                                          },
                                          options: { signature: 'none', insurance: null },
                                        },
                                      ]
                                    : selected.filter((p) => p.code !== provider.code),
                                  { shouldDirty: true, shouldValidate: formState.isSubmitted },
                                )
                              }
                            />
                          }
                        />
                        {unavailable && (
                          <Typography variant="caption" sx={{ display: 'block' }}>
                            {provider.usedInternationally
                              ? 'International quotes are not currently available'
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
                <Alert severity="warning">
                  No shipping services are available. Please contact an administrator.
                </Alert>
              )}
              {(formState.errors.providers?.message ||
                formState.errors.providers?.root?.message) && (
                <Alert severity="error">
                  {formState.errors.providers?.message || formState.errors.providers?.root?.message}
                </Alert>
              )}
              <Typography variant="h6">2. Where are you shipping from?</Typography>
              {selected.map((p, index) => {
                const configuration = providers.find((x) => x.code === p.code);
                return configuration ? (
                  <ProviderFields
                    key={p.code}
                    index={index}
                    configuration={configuration}
                    totalBoxes={totalBoxes}
                  />
                ) : null;
              })}
              <Typography variant="h6">3. Where is it going?</Typography>
              <AddressFields prefix="destination" label="Recipient" />
              {isInternational && international && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    <Typography variant="h6">International shipping details</Typography>
                    <TextField
                      label="Specific description of contents for label"
                      required
                      {...quoteField(
                        form,
                        'international.contentsDescription',
                        'For example: flour samples',
                      )}
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
                      required
                      {...quoteField(
                        form,
                        'international.totalValue.amount',
                        international.customsMode === 'detailed'
                          ? 'Calculated from the items and number of boxes you entered.'
                          : 'Combined value of everything in the shipment',
                      )}
                    />
                    <TextField
                      label="Customs currency"
                      required
                      {...quoteField(
                        form,
                        'international.totalValue.currency',
                        'Use a currency abbreviation, such as USD for US dollars.',
                      )}
                    />
                  </Stack>
                </Paper>
              )}
              <Typography variant="h6">4. What are you shipping?</Typography>
              <Typography variant="body2">
                Enter the size and weight of one box, then how many identical boxes you have. Add
                another box type if the size or weight differs.
              </Typography>
              {groups.fields.map((group, index) => (
                <Paper variant="outlined" key={group.id} sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    <Typography variant="h6">Box type {index + 1}</Typography>
                    <TextField
                      required
                      label={`Box type ${index + 1}: number of identical boxes`}
                      type="number"
                      {...quoteField(
                        form,
                        `packageGroups.${index}.quantity`,
                        'Each box must have the same size and weight.',
                        true,
                      )}
                    />
                    <TextField
                      select
                      label={`Box type ${index + 1}: measurement units`}
                      defaultValue={group.units}
                      {...quoteField(form, `packageGroups.${index}.units`)}
                    >
                      <MenuItem value="imperial">Inches / pounds</MenuItem>
                      <MenuItem value="metric">Centimeters / kilograms</MenuItem>
                    </TextField>
                    <Typography variant="body2">
                      {dimensionsOptional
                        ? 'Size is optional. Leave all three size fields blank, or enter length, width, and height together.'
                        : 'Enter all three box sizes: length, width, and height.'}{' '}
                      Weight is always required.
                    </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                        gap: 2,
                      }}
                    >
                      {(['length', 'width', 'height', 'weight'] as const).map((field) => (
                        <TextField
                          key={field}
                          required={field === 'weight' || !dimensionsOptional}
                          label={`Box type ${index + 1}: ${field} (${packageGroups[index]?.units === 'metric' ? (field === 'weight' ? 'kg' : 'cm') : field === 'weight' ? 'lb' : 'in'})`}
                          slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                          {...quoteField(
                            form,
                            `packageGroups.${index}.${field}`,
                            field === 'weight' ? 'Weight of one packed box' : undefined,
                          )}
                        />
                      ))}
                    </Box>
                    {(formState.errors.packageGroups?.[index]?.customsItems?.message ||
                      formState.errors.packageGroups?.[index]?.customsItems?.root?.message) && (
                      <Alert severity="error">
                        {formState.errors.packageGroups[index]?.customsItems?.message ||
                          formState.errors.packageGroups[index]?.customsItems?.root?.message}
                      </Alert>
                    )}
                    {international?.customsMode === 'detailed' && <CustomsFields index={index} />}
                    <Button
                      disabled={groups.fields.length === 1}
                      onClick={() => groups.remove(index)}
                    >
                      Remove box type {index + 1}
                    </Button>
                  </Stack>
                </Paper>
              ))}
              <Button onClick={() => groups.append(emptyGroup())}>Add another box type</Button>
              <Button
                type="submit"
                variant="contained"
                disabled={!providers.some((p) => p.enabled) || formState.isSubmitting}
              >
                {formState.isSubmitting ? 'Requesting prices…' : 'Compare quotes'}
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Box>
    </FormProvider>
  );
}
