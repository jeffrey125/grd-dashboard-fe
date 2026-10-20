import { z } from 'zod';

export const readinessSchema = z.object({
  id: z.uuid(),
  executionMode: z.enum(['request', 'browser']),
  state: z.enum(['queued', 'running', 'succeeded', 'failed']),
  failureSummary: z.enum(['readiness_failed', 'readiness_timeout']).nullable(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  testedBy: z.uuid(),
  savedAt: z.iso.datetime().nullable(),
});
export const providerSettingsSchema = z.array(
  z.object({
    code: z.enum(['amazon', 'unishippers']),
    name: z.string(),
    enabled: z.boolean(),
    executionMode: z.enum(['request', 'browser']),
    maintenanceMessage: z.string().nullable(),
    staleHours: z.number().int().min(1).max(168),
    revision: z.number().int(),
    updatedAt: z.iso.datetime(),
    updatedBy: z.uuid().nullable(),
    savedConnectionTest: readinessSchema.nullable(),
  }),
);
export const providerSettingsInput = z.object({
  revision: z.number().int(),
  enabled: z.boolean(),
  executionMode: z.enum(['request', 'browser']),
  maintenanceMessage: z.string().trim().max(500),
  staleHours: z.number().int().min(1).max(168),
  connectionTestId: z.uuid().optional(),
  acknowledgeFailure: z.boolean(),
});
export type ProviderSettings = z.infer<typeof providerSettingsSchema>[number];
export type ProviderSettingsInput = z.infer<typeof providerSettingsInput>;
