import { z } from 'zod';

const name = z
  .string()
  .trim()
  .min(1, 'Enter a name.')
  .max(100)
  .refine((value) => !value.includes('\0'), 'Remove null characters.');
const integer = (minimum: number) => z.number().int().min(minimum).max(32767);
const settingsSchema = z.strictObject({
  name,
  isActive: z.boolean(),
  fetchMode: z.enum(['request', 'browser']),
  notFoundPauseThreshold: integer(2),
  pollIntervalMinutes: integer(1),
  rateLimitPerMinute: integer(1).nullable(),
});
export const carrierSchema = settingsSchema.extend({
  externalId: z.uuidv4(),
  code: z.string().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type Carrier = z.infer<typeof carrierSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export const settingLabels: Record<keyof Settings, string> = {
  name: 'Name',
  isActive: 'Active',
  fetchMode: 'Fetch mode',
  notFoundPauseThreshold: 'Not-found pause threshold',
  pollIntervalMinutes: 'Polling interval (minutes)',
  rateLimitPerMinute: 'Requests per minute',
};
export function settings(carrier: Settings): Settings {
  return Object.fromEntries(
    Object.keys(settingLabels).map((key) => [key, carrier[key as keyof Settings]]),
  ) as Settings;
}
export function changedSettings(baseline: Settings, input: Settings): Partial<Settings> {
  return Object.fromEntries(
    Object.entries(input).filter(([key, value]) => value !== baseline[key as keyof Settings]),
  );
}
export function settingsVersion(carrier: Settings) {
  return JSON.stringify(settings(carrier));
}
export function settingsFor(code: string) {
  return settingsSchema.superRefine((value, context) => {
    if (
      !['ups', 'echoship', 'ffe'].includes(code) ||
      (code === 'ups' && value.fetchMode !== 'request')
    )
      context.addIssue({
        code: 'custom',
        path: ['fetchMode'],
        message: 'Unsupported fetch mode for this carrier.',
      });
  });
}
export const patchSchema = settingsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Change at least one setting.');
