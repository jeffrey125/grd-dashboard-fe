import { parseCalendarDate } from '@lib/dates';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { changeSearch, outcomes, type SearchState, searchErrors } from './search-state';

const filterLabels = {
  carrierExternalId: 'Carrier',
  lookupOutcome: 'Latest lookup',
  createdFrom: 'Created from',
  createdTo: 'Created to',
  estimatedDeliveryFrom: 'Delivery from',
  estimatedDeliveryTo: 'Delivery to',
};
export function SearchBox({
  value,
  error,
  onSearch,
}: {
  value: string;
  error?: string;
  onSearch: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => onSearch(draft), 350);
    return () => clearTimeout(timer);
  }, [draft, value, onSearch]);
  return (
    <TextField
      label="Search reference or notes"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      error={!!error}
      helperText={error ?? 'Search applies automatically after typing.'}
      fullWidth
    />
  );
}
export function ShipmentFilters({
  raw,
  carriers,
  onApply,
  onClear,
}: {
  raw: SearchState;
  carriers: Array<{ externalId: string; name: string; isActive: boolean }>;
  onApply: (next: SearchState) => void;
  onClear: () => void;
}) {
  const form = useForm<SearchState>({
    defaultValues: Object.fromEntries(
      Object.entries(raw).filter(
        ([key]) =>
          Object.hasOwn(filterLabels, key) ||
          (key !== 'q' && Object.hasOwn(searchErrors(raw), key)),
      ),
    ),
  });
  const [errors, setErrors] = useState(() => searchErrors(raw));
  const [dirty, setDirty] = useState(false);
  const extra = Object.keys(searchErrors(raw)).filter(
    (key) => !Object.hasOwn(filterLabels, key) && key !== 'q',
  );
  const submit = form.handleSubmit((values) => {
    const next = changeSearch(raw, values, false);
    const problems = searchErrors(next);
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setDirty(false);
    onApply(changeSearch(next, {}));
  });
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Stack
        component="form"
        noValidate
        spacing={2}
        onSubmit={submit}
        onChange={() => setDirty(true)}
        aria-label="Shipment filters"
      >
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(3, minmax(0, 1fr))',
            },
          }}
        >
          {Object.entries(filterLabels).map(([key, label]) => {
            const options =
              key === 'carrierExternalId'
                ? Object.fromEntries(
                    carriers.map((carrier) => [
                      carrier.externalId,
                      `${carrier.name}${carrier.isActive ? '' : ' (disabled)'}`,
                    ]),
                  )
                : key === 'lookupOutcome'
                  ? outcomes
                  : undefined;
            const value = raw[key];
            if (!options)
              return (
                <Controller
                  key={key}
                  name={key}
                  control={form.control}
                  defaultValue=""
                  render={({ field }) => {
                    const date = field.value ? parseCalendarDate(field.value) : null;
                    const invalid = !!date && !date.isValid();
                    return (
                      <Stack spacing={0.5}>
                        <DatePicker
                          label={label}
                          format="YYYY-MM-DD"
                          desktopModeMediaQuery="(min-width: 600px) and (pointer: fine)"
                          value={date}
                          minDate={parseCalendarDate('0001-01-01')}
                          maxDate={parseCalendarDate('9999-12-31')}
                          onChange={(next) => {
                            field.onChange(next ? next.format('YYYY-MM-DD') : '');
                            setDirty(true);
                          }}
                          inputRef={field.ref}
                          slotProps={{
                            textField: {
                              onBlur: field.onBlur,
                              error: invalid || !!errors[key],
                              helperText: invalid
                                ? `Invalid date: ${field.value}. Choose a date or clear this filter.`
                                : errors[key],
                            },
                            openPickerButton: { 'aria-label': `Choose ${label.toLowerCase()}` },
                            actionBar: { actions: ['clear', 'cancel', 'accept'] },
                          }}
                        />
                        {field.value && (
                          <Button
                            size="small"
                            sx={{ alignSelf: 'flex-start' }}
                            onClick={() => {
                              field.onChange('');
                              setDirty(true);
                            }}
                          >
                            Clear {label.toLowerCase()}
                          </Button>
                        )}
                      </Stack>
                    );
                  }}
                />
              );
            return (
              <TextField
                key={key}
                label={label}
                {...form.register(key)}
                defaultValue={value ?? ''}
                select
                slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                error={!!errors[key]}
                helperText={errors[key]}
              >
                <option value="">Any</option>
                {value && !Object.hasOwn(options, value) && (
                  <option value={value}>{value} (unavailable or invalid)</option>
                )}
                {Object.entries(options).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </TextField>
            );
          })}
          {extra.map((key) => (
            <Stack key={key} spacing={1}>
              <TextField
                label={`URL value: ${key}`}
                {...form.register(key)}
                error={!!errors[key]}
                helperText={errors[key]}
              />
              <Button
                onClick={() => {
                  form.setValue(key, '');
                  setDirty(true);
                }}
              >
                Clear {key}
              </Button>
            </Stack>
          ))}
        </Box>
        {errors.q && (
          <Alert severity="error">Correct the search text above before applying filters.</Alert>
        )}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Button type="submit" variant="contained">
            Apply filters
          </Button>
          <Button
            onClick={() => {
              form.reset({});
              setErrors({});
              setDirty(false);
              onClear();
            }}
          >
            Clear filters
          </Button>
          {dirty && (
            <Typography role="status" variant="body2">
              Unapplied changes
            </Typography>
          )}
        </Stack>
      </Stack>
    </LocalizationProvider>
  );
}
