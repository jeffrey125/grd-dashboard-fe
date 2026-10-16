import { ApiClient } from '@api/api';
import { shipmentFixture } from '@test/shipment-fixture';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { expect, it } from 'vitest';
import { createShipment } from './api';
import { createShipmentSchema, ShipmentValidationError } from './create-schema';

const input = {
  carrierExternalId: shipmentFixture().carrier.externalId,
  trackingReference: ' 001aB ',
  notes: '  ',
};

it('preserves literal identity while trimming fields and normalizing blank notes', () => {
  expect(createShipmentSchema.parse(input)).toEqual({
    ...input,
    trackingReference: '001aB',
    notes: null,
  });
});

it.each([
  { trackingReference: '  ' },
  { trackingReference: 'a\0b' },
  { trackingReference: 'a'.repeat(256) },
  { trackingReference: '😀'.repeat(128) },
  { notes: 'x'.repeat(501) },
  { notes: '\0' },
  { carrierExternalId: '' },
  { carrierExternalId: 'not-a-uuid' },
  { extra: 'unsupported' },
])('rejects invalid input: %j', (changes) => {
  expect(createShipmentSchema.safeParse({ ...input, ...changes }).success).toBe(false);
});

it.each(['created', 'existing'] as const)('parses an %s creation response', async (outcome) => {
  const client = new ApiClient('');
  const result = { outcome, shipment: shipmentFixture() };
  client.http.defaults.adapter = async (config) => {
    expect(config.url).toBe('/shipments');
    expect(JSON.parse(config.data)).toEqual({
      ...input,
      trackingReference: '001aB',
      notes: null,
    });
    return {
      config,
      status: outcome === 'created' ? 201 : 200,
      statusText: '',
      headers: {},
      data: result,
    };
  };
  expect(await createShipment(client, createShipmentSchema.parse(input))).toEqual(result);
});

it('retains only validated field names from backend errors', async () => {
  const client = new ApiClient('');
  let body: unknown = {
    code: 'shipment_validation_failed',
    details: [{ field: 'carrierExternalId', message: 'private diagnostics' }],
    secret: 'private',
  };
  client.http.defaults.adapter = async () => {
    throw new AxiosError('private', '', undefined, undefined, {
      status: 400,
      statusText: '',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
      data: body,
    });
  };
  const parsed = createShipmentSchema.parse(input);
  await expect(createShipment(client, parsed)).rejects.toMatchObject({
    fields: [{ field: 'carrierExternalId' }],
  });
  await createShipment(client, parsed).catch((error) =>
    expect(JSON.stringify(error)).not.toContain('private'),
  );
  for (body of [
    { code: 'other', details: [] },
    { code: 'shipment_validation_failed', details: [{ field: 'private' }] },
  ]) {
    await createShipment(client, parsed).catch((error) =>
      expect(error).not.toBeInstanceOf(ShipmentValidationError),
    );
  }
});
