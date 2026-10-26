import type { Carrier } from '@features/carriers/schemas';

export const carrierFixture: Carrier = {
  externalId: '11111111-1111-4111-8111-111111111111',
  code: 'ups',
  name: 'UPS',
  isActive: true,
  failurePauseEnabled: true,
  failurePauseThreshold: 2,
  sessionFailureDisableEnabled: true,
  sessionFailureDisableThreshold: 2,
  consecutiveSessionFailures: 0,
  sessionGeneration: 0,
  autoDisabledReason: null,
  fetchMode: 'request',
  notFoundPauseThreshold: 5,
  pollIntervalMinutes: 30,
  rateLimitPerMinute: 10,
  createdAt: '2026-10-16T10:00:00Z',
  updatedAt: '2026-10-16T10:00:00Z',
};
