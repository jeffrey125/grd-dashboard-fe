import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import type { Address } from './schemas';

let configured = false;

export async function loadPlaces() {
  const key = import.meta.env.VITE_GOOGLE_PLACES_API_KEY?.trim();
  if (!key) throw new Error('Address search is unavailable');

  if (!configured) {
    setOptions({ key, v: 'quarterly', language: 'en', region: 'US' });
    configured = true;
  }

  return importLibrary('places');
}

// Map Google's structured address components; never parse a formatted address.
export function addressFromPlace(
  components:
    | Pick<google.maps.places.AddressComponent, 'types' | 'shortText' | 'longText'>[]
    | undefined,
): Pick<Address, 'street' | 'city' | 'division' | 'postalCode' | 'country'> {
  const component = (type: string, short = false) => {
    const value = components?.find((entry) => entry.types.includes(type));
    return (short ? value?.shortText : value?.longText) ?? '';
  };

  if (component('country', true) !== 'US') {
    throw new Error('Choose a US address');
  }

  return {
    street: [component('street_number'), component('route')].filter(Boolean).join(' '),
    city: component('locality') || component('postal_town') || component('sublocality_level_1'),
    division: component('administrative_area_level_1', true),
    postalCode: [component('postal_code'), component('postal_code_suffix')]
      .filter(Boolean)
      .join('-'),
    country: 'US',
  };
}
