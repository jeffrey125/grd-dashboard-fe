import { z } from 'zod';

const identity = z.object({ externalId: z.uuidv4() });
const schemas = {
  resync: z.object({}),
  heartbeat: z.object({}),
  'shipment.changed': identity,
  'run.changed': identity,
  'tracking.changed': identity.extend({
    snapshotExternalId: z.uuidv4(),
    observedAt: z.iso.datetime(),
  }),
};

export type LiveEvent = {
  [K in keyof typeof schemas]: K extends 'resync' | 'heartbeat'
    ? { type: K }
    : { type: K } & z.infer<(typeof schemas)[K]>;
}[keyof typeof schemas];

export const eventNames = Object.keys(schemas) as Array<keyof typeof schemas>;

export function parseEvent(type: keyof typeof schemas, data: string): LiveEvent | undefined {
  try {
    const result = schemas[type].safeParse(JSON.parse(data));
    if (result.success) return { type, ...result.data } as LiveEvent;
  } catch {
    // Never propagate untrusted event text into UI, logs, or query keys.
  }
}
