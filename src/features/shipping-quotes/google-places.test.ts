import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { expect, it, vi } from 'vitest';
import { addressFromPlace, loadPlaces } from './google-places';

vi.mock('@googlemaps/js-api-loader', () => ({ importLibrary: vi.fn(), setOptions: vi.fn() }));

const component = (type: string, longText: string, shortText = longText) => ({
  types: [type],
  longText,
  shortText,
});

it('maps a US address with a state abbreviation and ZIP+4 without inventing missing fields', () => {
  expect(
    addressFromPlace([
      component('country', 'United States', 'US'),
      component('street_number', '123'),
      component('route', 'Example Street'),
      component('locality', 'Brooklyn'),
      component('administrative_area_level_1', 'New York', 'NY'),
      component('postal_code', '11201'),
      component('postal_code_suffix', '1234'),
    ]),
  ).toEqual({
    street: '123 Example Street',
    city: 'Brooklyn',
    division: 'NY',
    postalCode: '11201-1234',
    country: 'US',
  });
  expect(addressFromPlace([component('country', 'US')])).toEqual({
    street: '',
    city: '',
    division: '',
    postalCode: '',
    country: 'US',
  });
});

it('rejects non-US or unknown countries rather than relabeling them as US', () => {
  expect(() => addressFromPlace([component('country', 'Canada', 'CA')])).toThrow();
  expect(() => addressFromPlace(undefined)).toThrow();
});

it('requires a key and configures the official loader once for both address fields', async () => {
  vi.stubEnv('VITE_GOOGLE_PLACES_API_KEY', '');
  await expect(loadPlaces()).rejects.toThrow('Address search is unavailable');
  expect(importLibrary).not.toHaveBeenCalled();
  vi.stubEnv('VITE_GOOGLE_PLACES_API_KEY', 'test-browser-key');
  await loadPlaces();
  await loadPlaces();
  expect(setOptions).toHaveBeenCalledExactlyOnceWith({
    key: 'test-browser-key',
    v: 'quarterly',
    language: 'en',
    region: 'US',
  });
  expect(importLibrary).toHaveBeenCalledWith('places');
});
