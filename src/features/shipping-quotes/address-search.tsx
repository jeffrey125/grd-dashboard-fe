import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Paper, { type PaperProps } from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { addressFromPlace, loadPlaces } from './google-places';

function SuggestionsPaper({ children, ...props }: PaperProps) {
  return (
    <Paper {...props}>
      {children}
      <Typography
        translate="no"
        sx={{
          px: 2,
          py: 1,
          fontSize: 12,
          fontWeight: 400,
          whiteSpace: 'nowrap',
          color: (theme) => (theme.palette.mode === 'dark' ? '#fff' : '#5e5e5e'),
        }}
      >
        Google Maps
      </Typography>
    </Paper>
  );
}

export function AddressSearch({
  label,
  onSelect,
}: {
  label: string;
  onSelect: (address: ReturnType<typeof addressFromPlace>) => void;
}) {
  const [input, setInput] = useState('');
  const [options, setOptions] = useState<google.maps.places.PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState('');
  const generation = useRef(0);
  const session = useRef<google.maps.places.AutocompleteSessionToken | undefined>(undefined);

  const search = useDebouncedCallback(async (value: string, request: number) => {
    try {
      const places = await loadPlaces();
      if (generation.current !== request) return;
      session.current ??= new places.AutocompleteSessionToken();
      const response = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: value,
        includedRegionCodes: ['us'],
        sessionToken: session.current,
      });
      if (generation.current !== request) return;
      setOptions(
        response.suggestions.flatMap(({ placePrediction }) =>
          placePrediction ? [placePrediction] : [],
        ),
      );
    } catch {
      if (generation.current !== request) return;
      session.current = undefined;
      setFailure('Address search is unavailable. Enter the address manually.');
    } finally {
      if (generation.current === request) setLoading(false);
    }
  }, 300);

  useEffect(
    () => () => {
      generation.current += 1;
      search.cancel();
      session.current = undefined;
    },
    [search],
  );

  async function select(prediction: google.maps.places.PlacePrediction) {
    search.cancel();
    const request = ++generation.current;
    setLoading(true);
    setFailure('');
    setOptions([]);
    session.current = undefined;

    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ['addressComponents'] });
      if (generation.current !== request) return;
      onSelect(addressFromPlace(place.addressComponents));
    } catch {
      if (generation.current === request) {
        setFailure('Unable to load this US address. Enter the address manually.');
      }
    } finally {
      if (generation.current === request) setLoading(false);
    }
  }

  return (
    <Stack spacing={1}>
      <Autocomplete
        value={null}
        inputValue={input}
        options={options}
        filterOptions={(items) => items}
        getOptionLabel={(option) => option.text.toString()}
        getOptionKey={(option) => option.placeId}
        loading={loading}
        loadingText="Searching addresses…"
        noOptionsText={
          input.trim().length < 3
            ? 'Type at least 3 characters'
            : 'No suggestions. You can enter the address manually.'
        }
        slots={{ paper: SuggestionsPaper }}
        onInputChange={(_, value, reason) => {
          if (reason !== 'input' && reason !== 'clear') return;
          const request = ++generation.current;
          search.cancel();
          setInput(value);
          setOptions([]);
          setFailure('');
          const ready = value.trim().length >= 3;
          setLoading(ready);
          if (ready) search(value.trim(), request);
          else session.current = undefined;
        }}
        onChange={(_, value) => {
          if (value) void select(value);
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={`${label} address search`}
            helperText="Search for a US street address, then select a suggestion."
          />
        )}
      />
      {failure && <Alert severity="warning">{failure}</Alert>}
    </Stack>
  );
}
