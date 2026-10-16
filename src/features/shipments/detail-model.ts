import { ApiError } from '@api/api';
import { createShipmentSchema } from './create-schema';
import type { Shipment, TrackingRun } from './schemas';

export const notesSchema = createShipmentSchema.pick({ notes: true });
export function normalizedNote(value: string | null) {
  return value?.trim() || null;
}
export function noteConflict(baseline: string | null, draft: string, latest: string | null) {
  const value = normalizedNote(draft);
  return value !== baseline && latest !== baseline && latest !== value;
}
export function verificationLink(value: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function monitoringLabel(row: Shipment) {
  if (row.monitoringStatus === 'completed') return 'Delivered';
  if (row.monitoringStatus === 'active') return 'Active';
  return row.monitoringReason === 'manual' ? 'Paused manually' : 'Paused: not found';
}
export function activeRun(run: TrackingRun) {
  return run.status === 'queued' || run.status === 'running';
}
export function runPollInterval(run: TrackingRun, error: unknown) {
  if (error instanceof ApiError && [401, 403, 404].includes(error.status)) return false;
  return activeRun(run) ? 15_000 : false;
}
const diagnostics: Record<string, string> = {
  TIMEOUT: 'The carrier request timed out.',
  CARRIER_DISABLED: 'The carrier is disabled.',
  SHIPMENT_STATE_CHANGED: 'Shipment monitoring changed before the check.',
  RUN_CANCELLED: 'The run was cancelled.',
  WORKER_SHUTDOWN: 'Processing stopped before the check finished.',
  WORKER_INTERRUPTED: 'Processing was interrupted.',
};
export function diagnosticMessage(code: string | null) {
  return code
    ? Object.hasOwn(diagnostics, code)
      ? diagnostics[code]
      : 'No further diagnostic details are available.'
    : null;
}
