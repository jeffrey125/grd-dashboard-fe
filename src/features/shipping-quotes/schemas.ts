import { z } from 'zod';

const text = z
  .string()
  .min(1)
  .max(200)
  .refine((value) => value.trim().length > 0);
const decimal = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/)
  .refine((value) => Number(value) > 0);
const country = z.string().regex(/^[A-Z]{2}$/);
const providerCode = z.enum(['amazon', 'unishippers']);
const addressSchema = z.strictObject({
  name: text,
  street: text,
  street2: z.string().max(200).optional(),
  city: text,
  division: z.string().max(100),
  postalCode: text,
  country,
});
const senderSchema = z.discriminatedUnion('mode', [
  z.strictObject({
    mode: z.literal('explicit'),
    address: addressSchema.extend({ country: z.literal('US') }),
  }),
  z.strictObject({ mode: z.literal('account_default'), refreshId: z.uuidv4() }),
]);
const itemSchema = z.strictObject({
  description: text,
  quantity: z.number().int().positive().max(10000),
  unitValue: decimal,
  currency: z.string().regex(/^[A-Z]{3}$/),
  countryOfManufacture: country,
  weight: decimal,
  hsCode: z
    .string()
    .regex(/^(?:\d{6,10})?$/)
    .optional(),
});
export const createQuoteSchema = z
  .strictObject({
    idempotencyKey: z.uuidv4(),
    shipDate: z.iso.date(),
    destination: addressSchema,
    providers: z
      .array(
        z.strictObject({
          code: providerCode,
          sender: senderSchema,
          options: z.strictObject({
            signature: z.enum(['none', 'signature', 'adult_signature']),
            insurance: z
              .strictObject({ amount: decimal, currency: z.string().regex(/^[A-Z]{3}$/) })
              .nullable(),
          }),
        }),
      )
      .min(1)
      .max(2),
    packageGroups: z
      .array(
        z.strictObject({
          quantity: z.number().int().positive().max(10000),
          units: z.enum(['imperial', 'metric']),
          length: decimal,
          width: decimal,
          height: decimal,
          weight: decimal,
          customsItems: z.array(itemSchema).max(100),
        }),
      )
      .min(1)
      .max(100),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.providers.map((p) => p.code)).size !== value.providers.length)
      ctx.addIssue({ code: 'custom', path: ['providers'], message: 'Select each provider once' });
    if (value.destination.country !== 'US')
      value.packageGroups.forEach((group, index) => {
        if (!group.customsItems.length)
          ctx.addIssue({
            code: 'custom',
            path: ['packageGroups', index, 'customsItems'],
            message: 'International packages require per-box customs items',
          });
      });
  });
export type QuoteInput = z.infer<typeof createQuoteSchema>;
export type Address = z.infer<typeof addressSchema>;
export type ProviderCode = z.infer<typeof providerCode>;
export const comparisonSchema = z.object({
  externalId: z.uuidv4(),
  status: z.literal('saved'),
  ratesRun: z.literal(false),
  createdAt: z.iso.datetime(),
  createdBy: z.uuidv4(),
  input: createQuoteSchema,
  senders: z.array(
    z.object({
      code: providerCode,
      address: addressSchema,
      retrievedAt: z.iso.datetime().nullable(),
      mode: z.enum(['explicit', 'account_default']),
    }),
  ),
  warnings: z.array(z.string()),
});
export const providersSchema = z.array(
  z.object({ code: providerCode, name: z.string(), enabled: z.boolean() }),
);
export const refreshSchema = z.object({
  refreshId: z.uuidv4(),
  address: addressSchema,
  retrievedAt: z.iso.datetime(),
});
export type SenderRefresh = z.infer<typeof refreshSchema>;
export type Provider = z.infer<typeof providersSchema>[number];
