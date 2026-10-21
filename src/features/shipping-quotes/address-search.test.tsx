import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { AddressSearch } from './address-search';
import { loadPlaces } from './google-places';

vi.mock('./google-places', async (original) => ({
  ...(await original<typeof import('./google-places')>()),
  loadPlaces: vi.fn(),
}));

const fetchSuggestions = vi.fn();
const fetchFields = vi.fn();
const prediction = {
  placeId: 'test-place',
  text: { toString: () => '123 Example Street, Brooklyn, NY' },
  toPlace: () => ({
    fetchFields,
    addressComponents: [
      { types: ['country'], longText: 'United States', shortText: 'US' },
      { types: ['street_number'], longText: '123' },
      { types: ['route'], longText: 'Example Street' },
      { types: ['locality'], longText: 'Brooklyn' },
      { types: ['administrative_area_level_1'], shortText: 'NY' },
      { types: ['postal_code'], longText: '11201' },
    ],
  }),
};

beforeEach(() => {
  fetchSuggestions
    .mockReset()
    .mockResolvedValue({ suggestions: [{ placePrediction: prediction }] });
  fetchFields.mockReset().mockResolvedValue({});
  vi.mocked(loadPlaces).mockResolvedValue({
    AutocompleteSessionToken: class {},
    AutocompleteSuggestion: { fetchAutocompleteSuggestions: fetchSuggestions },
  } as unknown as google.maps.PlacesLibrary);
});

it('debounces typing, restricts to US, uses a session and fetches only address fields on keyboard selection', async () => {
  const user = userEvent.setup();
  const select = vi.fn();
  render(<AddressSearch label="Sender" onSelect={select} />);
  const input = screen.getByRole('combobox', { name: 'Sender address search' });
  await user.type(input, '123 Example');
  expect(fetchSuggestions).not.toHaveBeenCalled();
  await screen.findByRole('option');
  expect(fetchSuggestions).toHaveBeenCalledTimes(1);
  expect(fetchSuggestions).toHaveBeenCalledWith(
    expect.objectContaining({
      input: '123 Example',
      includedRegionCodes: ['us'],
      sessionToken: expect.any(Object),
    }),
  );
  expect(screen.getByText('Google Maps')).toBeVisible();
  await user.keyboard('{ArrowDown}{Enter}');
  await waitFor(() =>
    expect(select).toHaveBeenCalledWith({
      street: '123 Example Street',
      city: 'Brooklyn',
      division: 'NY',
      postalCode: '11201',
      country: 'US',
    }),
  );
  expect(fetchFields).toHaveBeenCalledExactlyOnceWith({ fields: ['addressComponents'] });
});

it('ignores superseded suggestions and reuses the token within one search session', async () => {
  let resolveFirst!: (value: unknown) => void;
  fetchSuggestions.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
  );
  const user = userEvent.setup();
  render(<AddressSearch label="Sender" onSelect={vi.fn()} />);
  const input = screen.getByRole('combobox');
  await user.type(input, '123');
  await waitFor(() => expect(fetchSuggestions).toHaveBeenCalledTimes(1));
  await user.type(input, ' Main');
  await screen.findByRole('option');
  await act(async () => resolveFirst({ suggestions: [] }));
  expect(screen.getByRole('option')).toHaveTextContent('123 Example');
  expect(fetchSuggestions.mock.calls[0]?.[0].sessionToken).toBe(
    fetchSuggestions.mock.calls[1]?.[0].sessionToken,
  );
});

it('does not apply details after switching away from search', async () => {
  let resolveDetails!: () => void;
  fetchFields.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        resolveDetails = resolve;
      }),
  );
  const user = userEvent.setup();
  const select = vi.fn();
  const view = render(<AddressSearch label="Recipient" onSelect={select} />);
  await user.type(screen.getByRole('combobox'), '123');
  await user.click(await screen.findByRole('option'));
  view.unmount();
  await act(async () => resolveDetails());
  expect(select).not.toHaveBeenCalled();
});

it.each(['loader', 'suggestions', 'details'])(
  'offers safe manual fallback for %s failure',
  async (failure) => {
    if (failure === 'loader')
      vi.mocked(loadPlaces).mockRejectedValue(new Error('sensitive diagnostic'));
    if (failure === 'suggestions')
      fetchSuggestions.mockRejectedValue(new Error('sensitive diagnostic'));
    if (failure === 'details') fetchFields.mockRejectedValue(new Error('sensitive diagnostic'));
    const user = userEvent.setup();
    render(<AddressSearch label="Recipient" onSelect={vi.fn()} />);
    await user.type(screen.getByRole('combobox'), '123');
    if (failure === 'details') await user.click(await screen.findByRole('option'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter the address manually');
    expect(screen.queryByText(/sensitive diagnostic/)).not.toBeInTheDocument();
  },
);
