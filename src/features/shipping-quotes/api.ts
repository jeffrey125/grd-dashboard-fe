import { type ApiClient, ApiError } from '@api/api';
import { z } from 'zod';
import {
  type ProviderSettingsInput,
  providerSettingsSchema,
  readinessSchema,
} from './provider-admin-schemas';
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
export async function listComparisons(
  client: ApiClient,
  page: number,
  signal: AbortSignal,
  deleted = false,
) {
  return parse(
    z.object({
      items: z.array(comparisonSchema),
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      pageSize: z.literal(25),
    }),
    await client.request({ url: '/quote-comparisons', params: { page, deleted }, signal }),
  );
}
export async function changeComparison(
  client: ApiClient,
  id: string,
  action: { type: 'retry'; attemptId: string } | { type: 'delete' | 'restore' },
) {
  const suffix =
    action.type === 'retry'
      ? `/attempts/${action.attemptId}/retry`
      : action.type === 'restore'
        ? '/restore'
        : '';
  return parse(
    comparisonSchema,
    await client.request({
      url: `/quote-comparisons/${id}${suffix}`,
      method: action.type === 'delete' ? 'DELETE' : 'POST',
      data: {},
    }),
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

export async function getProviderSettings(client: ApiClient, signal: AbortSignal) {
  return parse(
    providerSettingsSchema,
    await client.request({ url: '/admin/shipping-providers', signal }),
  );
}
export async function saveProviderSettings(
  client: ApiClient,
  code: ProviderCode,
  data: ProviderSettingsInput,
) {
  return parse(
    providerSettingsSchema,
    await client.request({ url: `/admin/shipping-providers/${code}`, method: 'PATCH', data }),
  );
}
export async function testProviderReadiness(
  client: ApiClient,
  code: ProviderCode,
  executionMode: 'request' | 'browser',
) {
  return parse(
    readinessSchema,
    await client.request({
      url: `/admin/shipping-providers/${code}/connection-tests`,
      method: 'POST',
      data: { executionMode },
    }),
  );
}
export async function getProviderReadiness(
  client: ApiClient,
  code: ProviderCode,
  id: string,
  signal: AbortSignal,
) {
  return parse(
    readinessSchema,
    await client.request({
      url: `/admin/shipping-providers/${code}/connection-tests/${id}`,
      signal,
    }),
  );
}
