import { z } from 'zod';
import { QuoteDecimal } from './quote-decimal';
import type { Provider, QuoteInput } from './schemas';

export const publishedWeightLimits = { amazon: '50', unishippers: '150' } as const;
export const maxPackageWeightSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/)
  .refine((value) => Number(value) > 0, 'Enter a positive weight in pounds');

export function overweightGroups(groups: QuoteInput['packageGroups'], provider: Provider) {
  return groups.flatMap((group, position) => {
    // The API converts the configured limit with Math.js. Compare in input units
    // so a rounded lb conversion cannot let a slightly overweight kg box through.
    const limit =
      group.units === 'metric' ? provider.maxPackageWeightKg : provider.maxPackageWeightLb;
    if (!limit || !/^\d+(?:\.\d+)?$/.test(group.weight)) return [];
    return new QuoteDecimal(group.weight).gt(limit) ? [position] : [];
  });
}

const policySchema = z.object({
  maxPackageWeightLb: z.string(),
  exceededPackageGroupPositions: z.array(z.number().int().nonnegative()),
});

export function weightLimitMessage(snapshot: Record<string, unknown> | null | undefined) {
  const policy = policySchema.safeParse(snapshot);
  if (!policy.success)
    return 'A box exceeds this provider’s current weight limit. Copy to a new comparison to change the weight.';
  return `Box type ${policy.data.exceededPackageGroupPositions.map((position) => position + 1).join(', ')} exceeds this provider’s ${new QuoteDecimal(policy.data.maxPackageWeightLb).toString()} lb per-box limit. This provider was skipped for the entire shipment.`;
}
