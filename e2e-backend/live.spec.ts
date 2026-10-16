import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    liveProbe: {
      sources: EventSource[];
      created: number;
      peak: number;
      events: Array<{ type: string; data: string }>;
    };
  }
}

for (const origin of ['http://localhost:4175', 'http://localhost:4176']) {
  test(`real SSE lifecycle, changes, reconnect and revocation at ${origin}`, async ({
    page,
    context,
  }) => {
    await page.addInitScript(() => {
      const NativeSource = window.EventSource;
      window.liveProbe = { sources: [], created: 0, peak: 0, events: [] };
      window.EventSource = class extends NativeSource {
        constructor(url: string | URL, init?: EventSourceInit) {
          super(url, init);
          const probe = window.liveProbe;
          probe.sources.push(this);
          probe.created++;
          probe.peak = Math.max(
            probe.peak,
            probe.sources.filter((source) => source.readyState !== 2).length,
          );
          for (const type of [
            'resync',
            'heartbeat',
            'shipment.changed',
            'run.changed',
            'tracking.changed',
          ]) {
            this.addEventListener(type, (event) =>
              probe.events.push({ type, data: (event as MessageEvent<string>).data }),
            );
          }
        }
      };
    });
    await page.goto(`${origin}/shipments`);
    await page.getByLabel('Email', { exact: true }).fill('frontend-staff@example.test');
    await page.getByLabel('Password', { exact: true }).fill('staff fixture password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => window.liveProbe.events.some((event) => event.type === 'resync')),
      )
      .toBe(true);
    expect(await page.evaluate(() => window.liveProbe.sources[0]?.withCredentials)).toBe(true);
    expect(await page.evaluate(() => window.liveProbe.sources[0]?.url)).toBe(
      `${origin.endsWith('4176') ? origin : 'http://localhost:3000'}/api/v1/events`,
    );
    for (let i = 0; i < 3; i++) {
      await page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('link', { name: 'Overview', exact: true })
        .click();
      await page.getByRole('link', { name: 'Shipments', exact: true }).click();
    }
    expect(
      await page.evaluate(() => ({
        created: window.liveProbe.created,
        peak: window.liveProbe.peak,
      })),
    ).toEqual({ created: 1, peak: 1 });

    const api = 'http://localhost:3000/api/v1';
    const headers = { Origin: origin };
    const carriers = await (await context.request.get(`${api}/carriers`)).json();
    const created = await context.request.post(`${api}/shipments`, {
      headers,
      data: {
        items: [
          {
            carrierExternalId: carriers[0].externalId,
            trackingReference: `sse-${origin.slice(-4)}-${Date.now()}`,
          },
        ],
      },
    });
    expect(created.status()).toBe(201);
    const id = (await created.json()).inserted[0].externalId;
    await expect
      .poll(() =>
        page.evaluate(
          (id) =>
            window.liveProbe.events.some(
              (event) =>
                event.type === 'shipment.changed' && JSON.parse(event.data).externalId === id,
            ),
          id,
        ),
      )
      .toBe(true);
    const run = await context.request.post(`${api}/shipments/${id}/refresh`, { headers });
    expect(run.status()).toBe(202);
    const runId = (await run.json()).externalId;
    await expect
      .poll(() =>
        page.evaluate(
          (id) =>
            window.liveProbe.events.some(
              (event) => event.type === 'run.changed' && JSON.parse(event.data).externalId === id,
            ),
          runId,
        ),
      )
      .toBe(true);
    expect(
      (
        await context.request.patch(`${api}/shipments/${id}`, {
          headers,
          data: { notes: 'SSE fixture edit' },
        })
      ).status(),
    ).toBe(200);
    expect(
      await page.evaluate(() =>
        window.liveProbe.events.filter((event) => event.type === 'tracking.changed'),
      ),
    ).toEqual([]);

    // Force transport loss while keeping HTTP/auth healthy. The replacement is a real stream.
    await page.evaluate(() => {
      const source = window.liveProbe.sources[0];
      source?.close();
      source?.dispatchEvent(new Event('error'));
    });
    await expect.poll(() => page.evaluate(() => window.liveProbe.created)).toBe(2);
    await expect
      .poll(() => page.evaluate(() => window.liveProbe.sources.at(-1)?.readyState))
      .toBe(1);
    await expect(page.getByRole('status').filter({ hasText: 'data may be stale' })).toHaveCount(0);
    expect((await context.request.delete(`${api}/shipments/${id}`, { headers })).status()).toBe(
      204,
    );
    expect((await context.request.get(`${api}/shipments/${id}`)).status()).toBe(404);
    expect(await page.evaluate(() => window.liveProbe.peak)).toBe(1);

    // Revoke through HTTP without navigating; server heartbeat closes the established stream.
    expect(
      (await context.request.post(`${api}/auth/sign-out`, { headers, data: {} })).status(),
    ).toBe(204);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible({ timeout: 25_000 });
    expect(
      await page.evaluate(() =>
        window.liveProbe.sources.every((source) => source.readyState === 2),
      ),
    ).toBe(true);
  });
}
