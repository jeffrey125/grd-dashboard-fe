import { parseSearchWith, stringifySearchWith } from '@tanstack/react-router';

// All public query fields are scalar. Avoid JSON interpretation of literal references
// (including long numeric strings) and keep page/date/filter URLs readable.
export const urlSearch = {
  parseSearch: parseSearchWith((value) => value),
  stringifySearch: stringifySearchWith(JSON.stringify),
};
