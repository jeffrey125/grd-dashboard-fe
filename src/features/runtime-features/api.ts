import { type ApiClient, ApiError } from '@api/api';
import { z } from 'zod';

const featuresSchema = z.object({ quoteComparisonEnabled: z.boolean() });

export async function getRuntimeFeatures(client: ApiClient, signal: AbortSignal) {
  const result = featuresSchema.safeParse(
    await client.request({ url: '/features', signal, auth: true }),
  );
  if (!result.success) throw new ApiError(0, 'Unable to check available pages.');
  return result.data;
}
