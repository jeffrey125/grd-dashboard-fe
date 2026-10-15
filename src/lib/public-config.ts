import { z } from 'zod';

const publicConfigSchema = z.object({
  VITE_API_ORIGIN: z
    .string()
    .url()
    .transform((value) => new URL(value))
    .refine((url) => {
      return (
        (url.protocol === 'http:' || url.protocol === 'https:') &&
        url.username === '' &&
        url.password === '' &&
        url.pathname === '/' &&
        url.search === '' &&
        url.hash === ''
      );
    })
    .transform((url) => url.origin)
    .default('http://localhost:3000'),
});

export function parsePublicConfig(environment: Record<string, unknown>) {
  const result = publicConfigSchema.safeParse(environment);

  if (!result.success) {
    throw new Error(
      'VITE_API_ORIGIN must be an HTTP(S) origin without credentials, a path, query, or fragment.',
    );
  }

  return { apiOrigin: result.data.VITE_API_ORIGIN };
}
