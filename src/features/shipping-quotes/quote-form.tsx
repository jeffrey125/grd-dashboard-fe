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
import { AddressSearch } from './address-search';
import { overweightGroups } from './provider-weight-policy';
import { QuoteDecimal } from './quote-decimal';
import { regionsForCountry } from './quote-standards';
import {
  type Address,
  createSharedQuoteFormSchema,
  type Provider,
  type QuoteInput,
  quoteInputFromShared,
  type SharedQuoteInput,
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
// Connect MUI's actual input (including selects) to React Hook Form for focus and errors.
function quoteField(
  form: UseFormReturn<SharedQuoteInput>,
  name: FieldPath<SharedQuoteInput>,
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
  configurations,
}: {
  prefix: 'destination' | 'sender';
  label: string;
  configurations: Provider[];
}) {
  const form = useFormContext<SharedQuoteInput>();
  const { watch } = form;
  const countryPath = `${prefix}.country` as const;
  const divisionPath = `${prefix}.division` as const;
  const country = watch(countryPath);
  const division = watch(divisionPath);
  const regions = regionsForCountry(country);
  const selected = watch('providers');
  const [expanded, setExpanded] = useState(() =>
    Object.entries(form.getValues(prefix)).some(
      ([key, value]) => key !== 'country' && Boolean(value),
    ),
  );
  const [searching, setSearching] = useState(true);
  const hasErrors = Boolean(form.formState.errors[prefix]);
  const configured = Boolean(import.meta.env.VITE_GOOGLE_PLACES_API_KEY?.trim());
  const requiring = (field: 'contactName' | 'phone' | 'division') =>
    configurations
      .filter(
        (provider) =>
          selected.some((entry) => entry.code === provider.code) &&
          provider.inputRequirements?.[prefix].requiredFields.includes(field),
      )
      .map((provider) => provider.name);
  const requirementHint = (field: 'contactName' | 'phone' | 'division') =>
    requiring(field).length ? `Required by ${requiring(field).join(', ')}` : undefined;

  return (
    <Stack spacing={2}>
      {configured && searching && (
        <AddressSearch
          label={label}
          onSelect={(address) => {
            for (const field of ['street', 'city', 'division', 'postalCode', 'country'] as const) {
              form.setValue(`${prefix}.${field}`, address[field], {
                shouldDirty: true,
                shouldValidate: true,
              });
            }
            setExpanded(true);
            setSearching(false);
          }}
        />
      )}
      {configured && (
        <Button
          type="button"
          sx={{ alignSelf: 'flex-start' }}
          aria-label={`${label}: ${searching ? 'Enter address manually' : 'Search for another address'}`}
          onClick={() => {
            setExpanded(true);
            setSearching(!searching);
          }}
        >
          {searching ? 'Enter address manually' : 'Search for another address'}
        </Button>
      )}
      {(expanded || hasErrors || !configured) && (
        <Box
          onChange={() => setSearching(false)}
          sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}
        >
          {(['name', 'street', 'street2', 'city'] as const).map((field) => (
            <TextField
              key={field}
              required={field !== 'street2'}
              label={`${label} ${{ name: 'company or name', street: 'address', street2: 'apartment / suite (optional)', city: 'city' }[field]}`}
              {...quoteField(form, `${prefix}.${field}`)}
            />
          ))}
          <TextField
            label={`${label} country`}
            value={country === 'US' ? 'United States' : country}
            slotProps={{ htmlInput: { readOnly: true } }}
            error={Boolean(form.getFieldState(countryPath, form.formState).error)}
            helperText={
              form.getFieldState(countryPath, form.formState).error?.message ?? 'US shipping only'
            }
          />
          {regions.length ? (
            <TextField
              select
              label={`${label} state / province`}
              value={division}
              required={requiring('division').length > 0}
              {...quoteField(
                form,
                divisionPath,
                requirementHint('division') ?? 'State, if applicable',
              )}
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
              required={requiring('division').length > 0}
              {...quoteField(
                form,
                divisionPath,
                requirementHint('division') ?? 'State, if applicable',
              )}
            />
          )}
          <TextField
            required
            label={`${label} ZIP / postal code`}
            {...quoteField(form, `${prefix}.postalCode`)}
          />
          <TextField
            required={requiring('contactName').length > 0}
            label={`${label} contact name${requiring('contactName').length ? '' : ' (optional)'}`}
            {...quoteField(form, `${prefix}.contactName`, requirementHint('contactName'))}
          />
          <TextField
            required={requiring('phone').length > 0}
            label={`${label} phone${requiring('phone').length ? '' : ' (optional)'}`}
            {...quoteField(
              form,
              `${prefix}.phone`,
              requirementHint('phone') ?? 'Include the country code, for example +1 202 555 0147',
            )}
          />
        </Box>
      )}
    </Stack>
  );
}
function SharedOptions({
  configurations,
  totalBoxes,
}: {
  configurations: Provider[];
  totalBoxes: number;
}) {
  const form = useFormContext<SharedQuoteInput>();
  const options = form.watch('options');
  const selected = form.watch('providers');
  const active = configurations.filter((provider) =>
    selected.some((entry) => entry.code === provider.code),
  );
  const signatureProviders = active.filter((provider) => provider.supportsSignature);
  const insuranceProviders = active.filter((provider) => provider.supportsInsurance);
  return (
    <Stack spacing={2}>
      {signatureProviders.length > 0 && (
        <TextField
          select
          label="Signature request"
          value={options.signature}
          {...quoteField(
            form,
            'options.signature',
            `Supported by ${signatureProviders.map((p) => p.name).join(', ')}`,
          )}
        >
          <MenuItem value="none">None</MenuItem>
          <MenuItem value="signature">Signature</MenuItem>
          <MenuItem value="adult_signature">Adult signature</MenuItem>
        </TextField>
      )}
      {options.signature !== 'none' && active.some((provider) => !provider.supportsSignature) && (
        <Alert severity="warning">
          Signature will not be requested from{' '}
          {active
            .filter((p) => !p.supportsSignature)
            .map((p) => p.name)
            .join(', ')}{' '}
          because it is unsupported.
        </Alert>
      )}
      {insuranceProviders.length > 0 && (
        <>
          <FormControlLabel
            label="Request insurance"
            control={
              <Checkbox
                checked={options.insurance !== null}
                onChange={(_, checked) =>
                  form.setValue(
                    'options.insurance',
                    checked ? { amount: '', currency: 'USD' } : null,
                    { shouldDirty: true, shouldValidate: form.formState.isSubmitted },
                  )
                }
              />
            }
          />
          {options.insurance && (
            <>
              <TextField
                label="Insured value per box"
                required
                {...quoteField(
                  form,
                  'options.insurance.amount',
                  `Supported by ${insuranceProviders.map((p) => p.name).join(', ')}`,
                )}
              />
              <Typography>Insurance currency: USD</Typography>
              {/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(options.insurance.amount) && (
                <Typography>
                  Total requested insurance:{' '}
                  {new QuoteDecimal(options.insurance.amount).times(totalBoxes).toFixed(2)} USD
                </Typography>
              )}
            </>
          )}
        </>
      )}
      {options.insurance && active.some((provider) => !provider.supportsInsurance) && (
        <Alert severity="warning">
          Insurance will not be requested from{' '}
          {active
            .filter((p) => !p.supportsInsurance)
            .map((p) => p.name)
            .join(', ')}{' '}
          because it is unsupported.
        </Alert>
      )}
    </Stack>
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
  const formSchema = useMemo(() => createSharedQuoteFormSchema(providers), [providers]);
  const originalSender = initial?.providers[0]?.sender;
  const defaultValues: SharedQuoteInput = {
    idempotencyKey: initial?.idempotencyKey ?? randomUUID(),
    shipDate: initial?.shipDate ?? businessCalendarDate(),
    destination: initial?.destination ?? emptyAddress(),
    sender:
      originalSender?.mode === 'explicit'
        ? originalSender.address
        : { ...emptyAddress(), country: 'US' },
    options: initial?.providers[0]?.options ?? { signature: 'none', insurance: null },
    providers: (initial?.providers ?? providers.filter((p) => p.enabled)).map(({ code }) => ({
      code,
    })),
    packageGroups: initial?.packageGroups.map((group) => ({ ...group, customsItems: [] })) ?? [
      emptyGroup(),
    ],
  };
  const form = useForm<SharedQuoteInput>({
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
  const packageGroups = watch('packageGroups');
  const selectedProviders = providers.filter(
    (provider) => provider.enabled && selected.some((entry) => entry.code === provider.code),
  );
  const noWeightEligibleProvider =
    selectedProviders.length > 0 &&
    selectedProviders.every((provider) => overweightGroups(packageGroups, provider).length > 0);
  const totalBoxes = packageGroups.reduce((sum, group) => sum + (group.quantity || 0), 0);
  const [failure, setFailure] = useState('');
  const lastSubmission = useRef<{ body: string; key: string } | undefined>(undefined);
  const submit = handleSubmit(
    async (valuesInput) => {
      const input = quoteInputFromShared(valuesInput, providers);
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
                    return (
                      <Box key={provider.code}>
                        <FormControlLabel
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
                                        },
                                      ]
                                    : selected.filter((p) => p.code !== provider.code),
                                  { shouldDirty: true, shouldValidate: formState.isSubmitted },
                                )
                              }
                            />
                          }
                        />
                        {provider.maxPackageWeightLb && (
                          <Typography variant="caption" component="div">
                            Maximum {Number(provider.maxPackageWeightLb)} lb per box
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
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={2}>
                  <Typography>
                    Enter the pickup address once. All selected shipping services use this sender.
                  </Typography>
                  <AddressFields prefix="sender" label="Sender" configurations={providers} />
                </Stack>
              </Paper>
              <Typography variant="h6">3. Where is it going?</Typography>
              <AddressFields prefix="destination" label="Recipient" configurations={providers} />
              {selected.map(({ code }) => {
                const provider = providers.find((entry) => entry.code === code);
                return (
                  <Stack key={code} spacing={1}>
                    {provider?.maintenanceMessage && (
                      <Alert severity="info">
                        {provider.name}: {provider.maintenanceMessage}
                      </Alert>
                    )}
                    {code === 'unishippers' && (
                      <Alert severity="info">
                        myUnishippers: For shipping within the US today. We estimate the total by
                        multiplying each box price by the number of identical boxes. Signature and
                        insurance are unavailable. Box sizes are optional only when comparing
                        myUnishippers alone; weight is required.
                      </Alert>
                    )}
                  </Stack>
                );
              })}
              <SharedOptions configurations={providers} totalBoxes={totalBoxes} />
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
                      {selectedProviders
                        .filter((provider) =>
                          overweightGroups(packageGroups, provider).includes(index),
                        )
                        .map((provider) => (
                          <Alert
                            key={provider.code}
                            severity="warning"
                            sx={{ gridColumn: '1 / -1' }}
                          >
                            Box type {index + 1} exceeds {provider.name}’s{' '}
                            {Number(provider.maxPackageWeightLb)} lb per-box limit. {provider.name}{' '}
                            will be skipped for this entire shipment.
                          </Alert>
                        ))}
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
              {noWeightEligibleProvider && (
                <Alert severity="error">
                  No selected provider can quote every box. Correct the weight or ask an admin to
                  adjust a provider limit.
                </Alert>
              )}
              <Button
                type="submit"
                variant="contained"
                disabled={
                  !providers.some((p) => p.enabled) ||
                  noWeightEligibleProvider ||
                  formState.isSubmitting
                }
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
