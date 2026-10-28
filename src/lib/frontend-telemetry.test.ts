import { describe, expect, it, vi } from 'vitest';
import { createReporter, safeFrames, safeRoute } from './frontend-telemetry';

describe('frontend diagnostics privacy and delivery', () => {
  it('removes query strings, fragments and arbitrary route segments', () => {
    expect(safeRoute('/shipments/customer-secret?token=secret#password')).toBe('/shipments/:id');
  });
  it('keeps only bundle frame locations, never messages or external URLs', () => {
    const error = new Error('password secret');
    error.stack =
      'Error: /assets/private-message-canary.js:1:2\n at f (https://app.example/assets/main-a1.js:12:34)\n at https://external.example/private.js?token=secret:1:2';
    expect(safeFrames(error)).toEqual(['assets/main-a1.js:12:34']);
  });
  it('does not report anonymous errors and bounds signed-in error storms', async () => {
    let enabled = false;
    const send = vi.fn().mockRejectedValue(new Error('offline'));
    const report = createReporter({
      enabled: () => enabled,
      endpoint: '/api/v1/telemetry/frontend',
      release: 'development',
      page: () => '/shipments/secret',
      send,
    });
    report('browser', new Error('secret'));
    expect(send).not.toHaveBeenCalled();
    enabled = true;
    for (let status = 500; status < 520; status++)
      report('api', new Error('secret'), { status, route: '/shipments/secret?token=hidden' });
    expect(send).toHaveBeenCalledTimes(10);
    expect(JSON.stringify(send.mock.calls)).not.toContain('secret');
    enabled = false;
    report('browser', new Error());
    expect(send).toHaveBeenCalledTimes(10);
    await Promise.resolve();
  });
  it('deduplicates and preserves a valid failed request correlation ID', () => {
    const send = vi.fn().mockResolvedValue({});
    const report = createReporter({
      enabled: () => true,
      endpoint: '/events',
      release: 'development',
      page: () => '/',
      send,
    });
    const details = { status: 503, failedRequestId: '11111111-1111-4111-8111-111111111111' };
    report('api', new Error(), details);
    report('api', new Error(), details);
    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(send.mock.calls[0]?.[1].body).failedRequestId).toBe(details.failedRequestId);
  });
});
