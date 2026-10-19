import { type ApiClient, ApiError } from '@api/api';
import { z } from 'zod';
import {
  comparisonSchema,
  type ProviderCode,
  providersSchema,
  type QuoteInput,
  refreshSchema,
} from './schemas';

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(0, 'Unexpected comparison response. Try again.');
  return result.data;
}
export async function getProviders(client: ApiClient, signal: AbortSignal) {
  return parse(
    providersSchema,
    await client.request({ url: '/quote-comparisons/providers', signal }),
  );
}
export async function getComparison(client: ApiClient, id: string, signal: AbortSignal) {
  return parse(comparisonSchema, await client.request({ url: `/quote-comparisons/${id}`, signal }));
}
export async function listComparisons(client: ApiClient, page: number, signal: AbortSignal) {
  return parse(
    z.object({
      items: z.array(comparisonSchema),
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      pageSize: z.literal(25),
    }),
    await client.request({ url: '/quote-comparisons', params: { page }, signal }),
  );
}
export async function saveComparison(client: ApiClient, input: QuoteInput) {
  return parse(
    z.object({ outcome: z.enum(['created', 'existing']), comparison: comparisonSchema }),
    await client.request({ url: '/quote-comparisons', method: 'POST', data: input }),
  );
}
export async function refreshSender(client: ApiClient, code: ProviderCode) {
  return parse(
    refreshSchema,
    await client.request({
      url: `/quote-comparisons/providers/${code}/default-refresh`,
      method: 'POST',
      data: {},
      timeout: 120000,
    }),
  );
}
