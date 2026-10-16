import { z } from 'zod';

const name = z
  .string()
  .trim()
  .min(1, 'Enter a name.')
  .max(100, 'Use 100 characters or fewer.')
  .refine((value) => !value.includes('\0'), 'Remove null characters.');

const timestamp = z.iso.datetime({ offset: true });

const salesRepSchema = z.object({
  externalId: z.uuidv4(),
  firstName: z.string(),
  lastName: z.string(),
  active: z.boolean(),
});

export const adminSalesRepSchema = salesRepSchema.extend({
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: timestamp.nullable(),
});

export const salesRepInputSchema = z.strictObject({
  firstName: name,
  lastName: name,
});

export type SalesRepInput = z.infer<typeof salesRepInputSchema>;
