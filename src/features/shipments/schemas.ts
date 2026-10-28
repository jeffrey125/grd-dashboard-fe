import { z } from 'zod';

const timestamp = z.iso.datetime({ offset: true });
const date = z.iso.date().nullable();
export const runSchema = z.object({
  externalId: z.uuidv4(),
  trigger: z.enum(['manual', 'scheduled']),
  fetchMode: z.enum(['request', 'browser']).nullable(),
  status: z.enum(['queued', 'running', 'succeeded', 'partially_succeeded', 'failed', 'cancelled']),
  attemptCount: z.number().int().nonnegative(),
  createdAt: timestamp,
  startedAt: timestamp.nullable(),
  completedAt: timestamp.nullable(),
});
export type TrackingRun = z.infer<typeof runSchema>;
export const runStatusSchema = runSchema.extend({
  carrierExternalId: z.uuidv4(),
  reasonCode: z.string().nullable(),
  attempts: z.array(
    z.object({
      shipmentExternalId: z.uuidv4(),
      outcome: z.enum(['pending', 'found', 'not_found', 'failed', 'skipped']),
      snapshotChanged: z.boolean(),
      retryable: z.boolean().nullable(),
      reasonCode: z.string().nullable(),
      completedAt: timestamp.nullable(),
    }),
  ),
});
export const carrierSchema = z.object({
  externalId: z.uuidv4(),
  code: z.string(),
  name: z.string(),
  isActive: z.boolean(),
});
export const salesRepSchema = z.object({
  externalId: z.uuidv4(),
  firstName: z.string(),
  lastName: z.string(),
  active: z.boolean(),
});
const employeeSummarySchema = z.object({
  externalId: z.uuidv4(),
  firstName: z.string(),
  lastName: z.string(),
});
const trackingSnapshotSchema = z.object({
  externalId: z.uuidv4(),
  carrierStatus: z.string().nullable(),
  carrierStatusDetail: z.string().nullable(),
  pickedUpOn: date,
  estimatedDeliveryOn: date,
  deliveredOn: date,
  observedAt: timestamp,
});
export type TrackingSnapshot = z.infer<typeof trackingSnapshotSchema>;
export const historyResponseSchema = z.object({
  items: z.array(trackingSnapshotSchema),
  page: z.number().int().positive().safe(),
  pageSize: z.union([z.literal(25), z.literal(50), z.literal(100)]),
  total: z.number().int().nonnegative().safe(),
});
export const shipmentSchema = z.object({
  externalId: z.uuidv4(),
  carrier: carrierSchema,
  trackingReference: z.string(),
  notes: z.string().nullable(),
  salesRep: salesRepSchema.nullable(),
  followUpOn: date,
  createdBy: employeeSummarySchema.nullable(),
  updatedBy: employeeSummarySchema.nullable(),
  recordUpdatedAt: timestamp.nullable(),
  recordUpdatedBy: employeeSummarySchema.nullable(),
  verificationUrl: z.string().nullable(),
  monitoringStatus: z.enum(['active', 'paused', 'completed']),
  monitoringReason: z
    .enum(['manual', 'not_found_threshold', 'failure_threshold', 'delivered'])
    .nullable(),
  lastAttemptedAt: timestamp.nullable(),
  nextCheckAt: timestamp.nullable(),
  consecutiveNotFoundCount: z.number().int().nonnegative(),
  consecutiveFailureCount: z.number().int().nonnegative(),
  createdAt: timestamp,
  updatedAt: timestamp,
  currentTracking: trackingSnapshotSchema.nullable(),
  latestLookup: z
    .object({
      runExternalId: z.uuidv4(),
      outcome: z.enum(['found', 'not_found', 'failed', 'skipped']),
      snapshotChanged: z.boolean(),
      retryable: z.boolean().nullable(),
      reasonCode: z.string().nullable(),
      completedAt: timestamp,
    })
    .nullable(),
  latestRun: runSchema.nullable(),
});
export const searchResponseSchema = z.object({
  items: z.array(shipmentSchema),
  page: z.number().int().positive(),
  pageSize: z.union([z.literal(25), z.literal(50), z.literal(100)]),
  total: z.number().int().nonnegative(),
  tabCounts: z.object({
    other: z.number().int().nonnegative().default(0),
    all: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    paused: z.number().int().nonnegative(),
    delivered: z.number().int().nonnegative(),
    attention: z.number().int().nonnegative(),
  }),
});
export type Shipment = z.infer<typeof shipmentSchema>;
