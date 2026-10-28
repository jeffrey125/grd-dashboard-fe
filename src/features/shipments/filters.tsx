import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useDebouncedCallback } from 'use-debounce';
import { changeSearch, type SearchState, searchErrors } from './search-state';

const filterLabels = {
  carrierExternalId: 'Carrier',
  salesRepExternalIds: 'Sales Reps',
  undeliveredOnly: 'Monitoring Status',
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
  const search = useDebouncedCallback(onSearch, 350);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (draft === value) {
      search.cancel();

      return;
    }

    search(draft);

    return search.cancel;
  }, [draft, value, search]);
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
  salesReps = [],
  onApply,
  onClear,
}: {
  raw: SearchState;
  carriers: Array<{ externalId: string; name: string; isActive: boolean }>;
  salesReps?: Array<{ externalId: string; firstName: string; lastName: string; active: boolean }>;
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
        <TextField
          label="Carrier"
          {...form.register('carrierExternalId')}
          defaultValue={raw.carrierExternalId ?? ''}
          select
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          error={!!errors.carrierExternalId}
          helperText={errors.carrierExternalId}
        >
          <option value="">Any</option>
          {raw.carrierExternalId &&
            !carriers.some((carrier) => carrier.externalId === raw.carrierExternalId) && (
              <option value={raw.carrierExternalId}>
                {raw.carrierExternalId} (unavailable or invalid)
              </option>
            )}
          {carriers.map((carrier) => (
            <option key={carrier.externalId} value={carrier.externalId}>
              {carrier.name}
              {carrier.isActive ? '' : ' (disabled)'}
            </option>
          ))}
        </TextField>
        <Controller
          name="salesRepExternalIds"
          control={form.control}
          defaultValue=""
          render={({ field }) => {
            const selected = field.value ? field.value.split(',') : [];
            const options = [
              'unassigned',
              ...[...salesReps]
                .sort((a, b) => Number(b.active) - Number(a.active))
                .map((rep) => rep.externalId),
              ...selected.filter(
                (id) => id !== 'unassigned' && !salesReps.some((rep) => rep.externalId === id),
              ),
            ];
            const label = (id: string) => {
              if (id === 'unassigned') return 'Unassigned';
              const rep = salesReps.find((item) => item.externalId === id);
              return rep
                ? `${rep.firstName} ${rep.lastName}${rep.active ? '' : ' (inactive)'}`
                : `${id} (unavailable or invalid)`;
            };
            return (
              <Autocomplete
                multiple
                disableCloseOnSelect
                options={[...new Set(options)]}
                value={[...new Set(selected)]}
                getOptionLabel={label}
                getOptionKey={(id) => id}
                onBlur={field.onBlur}
                onChange={(_, values) => {
                  field.onChange(values.join(','));
                  setDirty(true);
                }}
                renderOption={(props, id, { selected: checked }) => {
                  const { key, ...optionProps } = props;
                  return (
                    <li key={key} {...optionProps}>
                      <Checkbox checked={checked} tabIndex={-1} disableRipple sx={{ mr: 1 }} />
                      {label(id)}
                    </li>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    inputRef={field.ref}
                    label={filterLabels.salesRepExternalIds}
                    placeholder={selected.length ? undefined : 'Any sales rep'}
                    error={!!errors.salesRepExternalIds}
                    helperText={errors.salesRepExternalIds}
                  />
                )}
              />
            );
          }}
        />
        <TextField
          label={filterLabels.undeliveredOnly}
          select
          {...form.register('undeliveredOnly')}
          defaultValue={raw.undeliveredOnly ?? ''}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          error={!!errors.undeliveredOnly}
          helperText={errors.undeliveredOnly}
        >
          <option value="">Any</option>
          <option value="true">Undelivered only</option>
          <option value="false">Include delivered</option>
          {raw.undeliveredOnly && !['true', 'false'].includes(raw.undeliveredOnly) && (
            <option value={raw.undeliveredOnly}>{raw.undeliveredOnly} (invalid)</option>
          )}
        </TextField>
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
  );
}
