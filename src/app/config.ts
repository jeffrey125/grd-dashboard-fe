import { parsePublicConfig } from '@lib/public-config';

parsePublicConfig({
  VITE_API_ORIGIN: import.meta.env.VITE_API_ORIGIN,
});
