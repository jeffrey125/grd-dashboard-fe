import { businessCalendarDate } from '@lib/dates';
import { z } from 'zod';
import { QuoteDecimal } from './quote-decimal';
import { countryCodeSchema, currencyCodeSchema, isPossibleAddressPhone } from './quote-standards';

const text = z
  .string()
  .min(1, 'This field is required')
  .max(200, 'Use 200 characters or fewer')
  .refine((value) => value.trim().length > 0, 'This field is required');
const decimal = z
  .string()
  .regex(
    /^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/,
    'Enter a number greater than 0, without units or commas (for example, 12.5)',
  )
  .refine((value) => Number(value) > 0, 'Enter a number greater than 0');
const dimension = z
  .string()
  .refine(
    (value) => value === '' || decimal.safeParse(value).success,
    'Enter a number greater than 0, without units or commas (for example, 12.5)',
  );
const providerCode = z.enum(['amazon', 'unishippers']);
const addressSchema = z
  .strictObject({
    name: text,
    street: text,
    street2: z.string().max(200).optional(),
    city: text,
    division: z.string().max(100),
    postalCode: text,
    country: countryCodeSchema,
    contactName: z.string().max(100).optional(),
    phone: z.string().max(30).optional(),
  })
  .superRefine((address, ctx) => {
    if (address.phone !== undefined && !isPossibleAddressPhone(address.phone, address.country))
      ctx.addIssue({
        code: 'custom',
        path: ['phone'],
        message: 'Enter a possible phone number for the address country',
      });
  });
export const providersSchema = z.array(
  z.object({
    code: providerCode,
    name: z.string(),
    enabled: z.boolean(),
    maintenanceMessage: z.string().nullable().optional(),
    staleHours: z.number().int().min(1).max(168).optional(),
    cachedDefault: z
      .object({ address: addressSchema, retrievedAt: z.iso.datetime() })
      .nullable()
      .optional(),
    executionMode: z.enum(['api', 'request', 'browser']),
    usedInternationally: z.boolean(),
    internationalAvailable: z.boolean(),
    inputRequirements: z
      .object({
        sender: z.object({
          requiredFields: z.array(z.enum(['contactName', 'phone', 'division'])),
          maxNameLength: z.number().int().positive(),
          maxStreetLength: z.number().int().positive().optional(),
          maxContactNameLength: z.number().int().positive().optional(),
        }),
        destination: z.object({
          requiredFields: z.array(z.enum(['contactName', 'phone', 'division'])),
          maxNameLength: z.number().int().positive(),
          maxStreetLength: z.number().int().positive().optional(),
          maxContactNameLength: z.number().int().positive().optional(),
        }),
      })
      .optional(),
    supportsSignature: z.boolean(),
    supportsInsurance: z.boolean(),
  }),
);
export type Provider = z.infer<typeof providersSchema>[number];
const senderSchema = z.discriminatedUnion('mode', [
  z.strictObject({
    mode: z.literal('explicit'),
    address: addressSchema.safeExtend({ country: z.literal('US') }),
  }),
  z.strictObject({ mode: z.literal('account_default'), refreshId: z.uuidv4() }),
]);
const itemSchema = z.strictObject({
  description: text,
  quantity: z
    .number({ error: 'Enter a whole number of 1 or more' })
    .int('Enter a whole number')
    .positive('Enter at least 1')
    .max(10000, 'Enter 10,000 or fewer'),
  unitValue: decimal,
  currency: currencyCodeSchema,
  countryOfManufacture: countryCodeSchema,
  weight: decimal,
  hsCode: z
    .string()
    .regex(/^(?:\d{6,10})?$/)
    .optional(),
});
const internationalSchema = z.strictObject({
  contentsDescription: text,
  customsMode: z.enum(['summary', 'detailed']),
  totalValue: z.strictObject({
    amount: decimal,
    currency: currencyCodeSchema,
  }),
});
const createQuoteSchema = z
  .strictObject({
    idempotencyKey: z.uuidv4(),
    shipDate: z.iso.date({ error: 'Choose a valid ship date' }),
    destination: addressSchema,
    international: internationalSchema.optional(),
    providers: z
      .array(
        z.strictObject({
          code: providerCode,
          sender: senderSchema,
          options: z.strictObject({
            signature: z.enum(['none', 'signature', 'adult_signature']),
            insurance: z.strictObject({ amount: decimal, currency: currencyCodeSchema }).nullable(),
          }),
        }),
      )
      .min(1, 'Select at least one shipping service')
      .max(2),
    packageGroups: z
      .array(
        z.strictObject({
          quantity: z
            .number({ error: 'Enter a whole number of 1 or more' })
            .int('Enter a whole number')
            .positive('Enter at least 1')
            .max(10000, 'Enter 10,000 or fewer'),
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
        for (const field of ['length', 'width', 'height'] as const)
          if (group[field] === '')
            ctx.addIssue({
              code: 'custom',
              path: ['packageGroups', index, field],
              message:
                'Enter this size too, or clear all three size fields if using only myUnishippers',
            });
    });
    const isInternational = value.destination.country !== 'US';
    if (isInternational && !value.international)
      ctx.addIssue({
        code: 'custom',
        path: ['international'],
        message: 'International shipments require customs details',
      });
    if (!isInternational && value.international)
      ctx.addIssue({
        code: 'custom',
        path: ['international'],
        message: 'Customs details are only valid for international shipments',
      });
    if (!isInternational || !value.international) return;
    const international = value.international;
    const detailed = international.customsMode === 'detailed';
    let total = new QuoteDecimal(0);
    value.packageGroups.forEach((group, groupIndex) => {
      if (detailed && !group.customsItems.length)
        ctx.addIssue({
          code: 'custom',
          path: ['packageGroups', groupIndex, 'customsItems'],
          message: 'Detailed customs require per-box items for every package group',
        });
      if (!detailed && group.customsItems.length)
        ctx.addIssue({
          code: 'custom',
          path: ['packageGroups', groupIndex, 'customsItems'],
          message: 'Summary customs cannot include detailed items',
        });
      for (const [itemIndex, item] of group.customsItems.entries()) {
        if (item.currency !== international.totalValue.currency)
          ctx.addIssue({
            code: 'custom',
            path: ['packageGroups', groupIndex, 'customsItems', itemIndex, 'currency'],
            message: 'All customs values must use the shipment currency',
          });
        if (decimal.safeParse(item.unitValue).success)
          total = total.add(
            new QuoteDecimal(item.unitValue).times(item.quantity).times(group.quantity),
          );
      }
    });
    if (
      detailed &&
      decimal.safeParse(international.totalValue.amount).success &&
      !total.equals(international.totalValue.amount)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['international', 'totalValue', 'amount'],
        message: 'Total customs value must equal item quantity × unit value × box quantity',
      });
  });
function createQuoteFormSchema(_providers: Provider[]) {
  return createQuoteSchema.superRefine((value, ctx) => {
    if (value.destination.country !== 'US')
      ctx.addIssue({
        code: 'custom',
        path: ['destination', 'country'],
        message: 'V1 supports US destinations only',
      });
    const dimensionlessUnishippersOnly =
      value.providers.length === 1 && value.providers[0]?.code === 'unishippers';

    value.providers.forEach((provider, index) => {
      if (provider.sender.mode === 'account_default')
        ctx.addIssue({
          code: 'custom',
          path: ['providers', index, 'sender'],
          message: 'Enter a sender address for every selected shipping service',
        });
    });

    if (
      value.providers.some((provider) => provider.code === 'unishippers') &&
      value.shipDate !== businessCalendarDate()
    )
      ctx.addIssue({
        code: 'custom',
        path: ['shipDate'],
        message: "myUnishippers Quick Quote supports today's ship date only",
      });

    value.packageGroups.forEach((group, index) => {
      if (
        !dimensionlessUnishippersOnly &&
        [group.length, group.width, group.height].every((value) => value === '')
      )
        for (const field of ['length', 'width', 'height'] as const)
          ctx.addIssue({
            code: 'custom',
            path: ['packageGroups', index, field],
            message: 'Amazon requires length, width, and height. Enter all three sizes.',
          });
    });
  });
}
const sharedFormBase = z.strictObject({
  idempotencyKey: createQuoteSchema.shape.idempotencyKey,
  shipDate: createQuoteSchema.shape.shipDate,
  destination: addressSchema,
  sender: addressSchema.safeExtend({ country: z.literal('US') }),
  options: z.strictObject({
    signature: z.enum(['none', 'signature', 'adult_signature']),
    insurance: z.strictObject({ amount: z.string(), currency: z.string() }).nullable(),
  }),
  providers: z
    .array(z.strictObject({ code: providerCode }))
    .min(1, 'Select at least one shipping service'),
  packageGroups: createQuoteSchema.shape.packageGroups,
});
export type SharedQuoteInput = z.infer<typeof sharedFormBase>;

export function quoteInputFromShared(
  input: SharedQuoteInput,
  configurations: Provider[],
): QuoteInput {
  const { sender, options, providers, ...shipment } = input;
  return {
    ...shipment,
    providers: providers.map(({ code }) => {
      const configuration = configurations.find((provider) => provider.code === code);
      return {
        code,
        sender: { mode: 'explicit', address: { ...sender } },
        options: {
          signature: configuration?.supportsSignature ? options.signature : 'none',
          insurance: configuration?.supportsInsurance ? options.insurance : null,
        },
      };
    }),
  };
}

export function createSharedQuoteFormSchema(configurations: Provider[]) {
  return sharedFormBase.superRefine((input, ctx) => {
    const result = createQuoteFormSchema(configurations).safeParse(
      quoteInputFromShared(input, configurations),
    );
    if (!result.success)
      for (const issue of result.error.issues) {
        const path =
          issue.path[0] === 'providers' && issue.path[2] === 'sender'
            ? ['sender', ...issue.path.slice(4)]
            : issue.path[0] === 'providers' && issue.path[2] === 'options'
              ? ['options', ...issue.path.slice(3)]
              : issue.path;
        ctx.addIssue({ code: 'custom', path, message: issue.message });
      }
    for (const selected of input.providers) {
      const provider = configurations.find((entry) => entry.code === selected.code);
      if (!provider?.enabled) {
        ctx.addIssue({
          code: 'custom',
          path: ['providers'],
          message: 'Select an available shipping service',
        });
        continue;
      }
      for (const target of ['sender', 'destination'] as const) {
        const requirements = provider.inputRequirements?.[target];
        const maxNameLength =
          requirements?.maxNameLength ??
          (provider.code === 'amazon' ? 50 : target === 'sender' ? 35 : 200);
        if (input[target].name.length > maxNameLength)
          ctx.addIssue({
            code: 'custom',
            path: [target, 'name'],
            message: `${provider.name} requires ${maxNameLength} characters or fewer`,
          });
        const maxStreetLength =
          requirements?.maxStreetLength ?? (provider.code === 'amazon' ? 60 : 200);
        for (const field of ['street', 'street2'] as const)
          if ((input[target][field]?.length ?? 0) > maxStreetLength)
            ctx.addIssue({
              code: 'custom',
              path: [target, field],
              message: `${provider.name} requires ${maxStreetLength} characters or fewer`,
            });
        const maxContactNameLength =
          requirements?.maxContactNameLength ?? (provider.code === 'amazon' ? 50 : 100);
        if ((input[target].contactName?.length ?? 0) > maxContactNameLength)
          ctx.addIssue({
            code: 'custom',
            path: [target, 'contactName'],
            message: `${provider.name} requires ${maxContactNameLength} characters or fewer`,
          });
        for (const field of requirements?.requiredFields ?? [])
          if (!input[target][field]?.trim())
            ctx.addIssue({
              code: 'custom',
              path: [target, field],
              message: `Required by ${provider.name}`,
            });
      }
    }
    if (
      input.providers.some((provider) => provider.code === 'amazon') &&
      input.packageGroups.reduce((total, group) => total + group.quantity, 0) > 100
    )
      ctx.addIssue({
        code: 'custom',
        path: ['packageGroups'],
        message: 'Amazon supports at most 100 physical packages per comparison',
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
  deletedAt: z.iso.datetime().nullable().optional(),
  lastDeletedAt: z.iso.datetime().nullable().optional(),
  restoredAt: z.iso.datetime().nullable().optional(),
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
      createdAt: z.iso.datetime().optional(),
      sender: z
        .object({
          code: providerCode,
          address: addressSchema,
          mode: z.enum(['explicit', 'account_default']),
          retrievedAt: z.iso.datetime().nullable(),
        })
        .optional(),
      retryBlockedReason: z.string().nullable().optional(),
      executionMode: z.enum(['api', 'request', 'browser']).nullable(),
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
      conversionSnapshot: z.record(z.string(), z.unknown()).optional(),
      quotes: z.array(
        z.object({
          platform: z.string(),
          carrier: z.string(),
          service: z.string(),
          transportationTotal: z.string().regex(/^\d+(?:\.\d+)?$/),
          currency: currencyCodeSchema,
          estimateMethod: z.enum(['native', 'calculated']),
          transitDescription: z.string().nullable(),
          retrievedAt: z.iso.datetime(),
          expiresAt: z.iso.datetime().nullable(),
          staleAt: z.iso.datetime().nullable().optional(),
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
  expiresAt: z.iso.datetime().optional(),
  refreshId: z.uuidv4(),
  address: addressSchema,
  retrievedAt: z.iso.datetime(),
});
