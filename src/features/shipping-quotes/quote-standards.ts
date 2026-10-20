import { allCountries, type CountryData, type Region } from 'country-region-data';
import { type CountryCode, isPossiblePhoneNumber } from 'libphonenumber-js';
import validator from 'validator';
import { z } from 'zod';

export const countryCodeSchema = z
  .string()
  .refine(validator.isISO31661Alpha2, 'Choose a valid country');

export const currencyCodeSchema = z
  .string()
  .refine(validator.isISO4217, 'Enter a currency abbreviation, such as USD for US dollars');

export const addressCountries: CountryData[] = allCountries.filter(([, code]) =>
  validator.isISO31661Alpha2(code),
);

export function isSupportedCountryCode(value: string): boolean {
  return validator.isISO31661Alpha2(value);
}

export function regionsForCountry(country: string): Region[] {
  return addressCountries.find(([, code]) => code === country)?.[2] ?? [];
}

export function isPossibleAddressPhone(value: string, country: string): boolean {
  if (value === '') return true;
  if (!isSupportedCountryCode(country)) return false;

  try {
    return isPossiblePhoneNumber(value, country as CountryCode);
  } catch {
    return false;
  }
}
