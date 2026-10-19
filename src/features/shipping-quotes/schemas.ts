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
const dimension = z.union([z.literal(''), decimal]);
const country = z.string().regex(/^[A-Z]{2}$/);
const providerCode = z.enum(['amazon', 'unishippers']);
export const providersSchema = z.array(
  z.object({
    code: providerCode,
    name: z.string(),
    enabled: z.boolean(),
    executionMode: z.enum(['request', 'browser']),
  }),
);
export type Provider = z.infer<typeof providersSchema>[number];
const addressSchema = z.strictObject({
  name: text,
  street: text,
  street2: z.string().max(200).optional(),
  city: text,
  division: z.string().max(100),
  postalCode: text,
  country,
  contactName: z.string().max(100).optional(),
  phone: z
    .string()
    .max(30)
    .refine(
      (value) =>
        value === '' ||
        (/^\+?[\d ().-]+$/.test(value) && /^\d{10,15}$/.test(value.replace(/\D/g, ''))),
    )
    .optional(),
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
const createQuoteSchema = z
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
          length: dimension,
          width: dimension,
          height: dimension,
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
    value.packageGroups.forEach((group, index) => {
      const dimensions = [group.length, group.width, group.height];
      const populated = dimensions.filter((dimension) => dimension !== '');
      if (populated.length !== 0 && populated.length !== dimensions.length)
        ctx.addIssue({
          code: 'custom',
          path: ['packageGroups', index],
          message: 'Enter all dimensions or leave all three blank',
        });
    });
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
export function createQuoteFormSchema(providers: Provider[]) {
  const configurations = new Map(providers.map((provider) => [provider.code, provider]));

  return createQuoteSchema.superRefine((value, ctx) => {
    const dimensionsOptional =
      value.providers.length === 1 &&
      value.providers[0]?.code === 'unishippers' &&
      configurations.get('unishippers')?.executionMode === 'request';
    if (dimensionsOptional) return;

    value.packageGroups.forEach((group, index) => {
      if (group.length === '')
        ctx.addIssue({
          code: 'custom',
          path: ['packageGroups', index],
          message: 'Dimensions are required for the selected provider or execution mode',
        });
    });
  });
}
export type QuoteInput = z.infer<typeof createQuoteSchema>;
export type Address = z.infer<typeof addressSchema>;
export type ProviderCode = z.infer<typeof providerCode>;
export const comparisonSchema = z.object({
  externalId: z.uuidv4(),
  status: z.enum(['saved', 'queued', 'running', 'completed', 'failed']),
  ratesRun: z.boolean(),
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
  attempts: z.array(
    z.object({
      externalId: z.uuidv4(),
      provider: providerCode,
      status: z.enum(['saved', 'queued', 'running', 'completed', 'failed']),
      attemptNumber: z.number().int().positive(),
      executionMode: z.enum(['request', 'browser']).nullable(),
      startedAt: z.iso.datetime().nullable(),
      completedAt: z.iso.datetime().nullable(),
      recoveryCount: z.number().int().min(0).max(1),
      outcome: z
        .enum([
          'success',
          'validation_failed',
          'unsupported',
          'timeout',
          'authentication_failed',
          'failed',
        ])
        .nullable(),
      reasonCode: z.string().nullable(),
      simulated: z.boolean(),
      quotes: z.array(
        z.object({
          platform: z.string(),
          carrier: z.string(),
          service: z.string(),
          transportationTotal: z.string().regex(/^\d+(?:\.\d+)?$/),
          currency: z.string().regex(/^[A-Z]{3}$/),
          estimateMethod: z.enum(['native', 'calculated']),
          transitDescription: z.string().nullable(),
          retrievedAt: z.iso.datetime(),
          expiresAt: z.iso.datetime().nullable(),
          optionCoverage: z.enum(['included', 'unsupported', 'unverified']),
          dutyStatus: z.enum(['included', 'excluded', 'unknown']),
          taxStatus: z.enum(['included', 'excluded', 'unknown']),
          clearanceStatus: z.enum(['included', 'excluded', 'unknown']),
          charges: z.array(
            z.object({
              description: z.string(),
              amount: z.string().regex(/^\d+(?:\.\d+)?$/),
              scope: z.enum(['package', 'shipment', 'pickup']),
              packageGroupPosition: z.number().int().min(0).nullable(),
            }),
          ),
          groupContributions: z.array(
            z.object({
              packageGroupPosition: z.number().int().min(0),
              quantity: z.number().int().positive(),
              subtotal: z.string().regex(/^\d+(?:\.\d+)?$/),
            }),
          ),
        }),
      ),
    }),
  ),
});
export type Comparison = z.infer<typeof comparisonSchema>;
export const refreshSchema = z.object({
  refreshId: z.uuidv4(),
  address: addressSchema,
  retrievedAt: z.iso.datetime(),
});
export type SenderRefresh = z.infer<typeof refreshSchema>;
