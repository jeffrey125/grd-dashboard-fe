import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { changeSearch, type SearchState, searchErrors } from './search-state';

const filterLabels = {
  carrierExternalId: 'Carrier',
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
