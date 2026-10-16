import { ApiClient, ApiError } from '@api/api';
import { shipmentFixture } from '@test/shipment-fixture';
import { expect, it } from 'vitest';
import { deleteShipment, getRun, getShipment, saveShipmentNotes } from './api';
import {
  diagnosticMessage,
  normalizedNote,
  noteConflict,
  notesSchema,
  runPollInterval,
  verificationLink,
} from './detail-model';
import type { TrackingRun } from './schemas';

it.each([
  null,
  '',
  'javascript:alert(1)',
  'data:text/html,test',
  '//evil.test',
  '/relative',
  'https://user:pass@example.test',
  'malformed',
])('omits unsafe verification URL %s', (url) => {
  expect(verificationLink(url)).toBeUndefined();
});
it('permits absolute HTTP(S) verification links', () => {
  expect(verificationLink('https://carrier.test/track?q=001')).toBe(
    'https://carrier.test/track?q=001',
  );
  expect(verificationLink('http://carrier.test')).toBe('http://carrier.test/');
});
it('detects actual concurrent changes without confusing tracking updates or matching drafts', () => {
  expect(noteConflict('original', 'mine', 'theirs')).toBe(true);
  expect(noteConflict('original', 'mine', 'original')).toBe(false);
  expect(noteConflict('original', 'mine', 'mine')).toBe(false);
  expect(noteConflict('original', ' original ', 'theirs')).toBe(false);
  expect(noteConflict(null, '  ', 'theirs')).toBe(false);
  expect(normalizedNote(' \n ')).toBeNull();
  expect(noteConflict('original', '', null)).toBe(false);
});
it('uses the public notes contract, including null clearing and UTF-16 limits', () => {
  expect(notesSchema.parse({ notes: '  ' })).toEqual({ notes: null });
  expect(notesSchema.parse({ notes: ' note ' })).toEqual({ notes: 'note' });
  for (const notes of ['\0', 'x'.repeat(501), '😀'.repeat(251)])
    expect(notesSchema.safeParse({ notes }).success).toBe(false);
});
it('polls only active runs and stops for terminal or inaccessible records', () => {
  for (const status of ['queued', 'running'] as const) {
    expect(runPollInterval({ status } as TrackingRun, null)).toBe(15000);
    for (const code of [401, 403, 404])
      expect(runPollInterval({ status } as TrackingRun, new ApiError(code, 'unavailable'))).toBe(
        false,
      );
  }
  for (const status of ['succeeded', 'partially_succeeded', 'failed', 'cancelled'] as const)
    expect(runPollInterval({ status } as TrackingRun, null)).toBe(false);
});
it('never echoes unknown diagnostics', () => {
  expect(diagnosticMessage('TIMEOUT')).toContain('timed out');
  expect(diagnosticMessage('private provider diagnostic')).toBe(
    'No further diagnostic details are available.',
  );
  for (const code of ['__proto__', 'constructor', 'toString']) {
    expect(diagnosticMessage(code)).toBe('No further diagnostic details are available.');
  }
});
it('reads public detail and patches only notes, with correct soft-delete 204 handling', async () => {
  const client = new ApiClient('');
  const row = shipmentFixture();
  const methods: string[] = [];
  client.http.defaults.adapter = async (config) => {
    expect(config.url).toBe(`/shipments/${row.externalId}`);
    methods.push(config.method ?? '');
    if (config.method === 'patch') expect(JSON.parse(config.data)).toEqual({ notes: null });
    if (config.method === 'get') expect(config.signal).toBeDefined();
    return {
      config,
      status: config.method === 'delete' ? 204 : 200,
      statusText: '',
      headers: {},
      data: row,
    };
  };
  expect(await getShipment(client, row.externalId, new AbortController().signal)).toEqual(row);
  await saveShipmentNotes(client, row.externalId, null);
  expect(await deleteShipment(client, row.externalId)).toBeUndefined();
  expect(methods).toEqual(['get', 'patch', 'delete']);
});
it('rejects malformed detail/run responses without leaking their contents', async () => {
  const client = new ApiClient('');
  client.http.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: '',
    headers: {},
    data: { secret: 'private' },
  });
  const signal = new AbortController().signal;
  await expect(getShipment(client, shipmentFixture().externalId, signal)).rejects.toThrow(
    'unexpected shipment response',
  );
  await expect(getRun(client, shipmentFixture().externalId, signal)).rejects.toThrow(
    'unexpected shipment response',
  );
});
