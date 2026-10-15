import { parsePublicConfig } from '@lib/public-config';

export const publicConfig = parsePublicConfig({
  VITE_API_ORIGIN: import.meta.env.VITE_API_ORIGIN,
});
