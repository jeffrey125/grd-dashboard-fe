import type { BrowserContext, Page } from '@playwright/test';
import { emptyOverview } from '@test/overview-fixture';
import { emptyShipments } from '@test/shipment-fixture';

declare global {
  interface Window {
    liveFixture: {
      active: number;
      created: number;
      peak: number;
      emit: (type: string, data?: unknown) => void;
      disconnect: () => void;
    };
  }
}

/** Deterministic transport only; the backend suite uses the browser's real EventSource. */
export async function installLiveFixture(surface: BrowserContext | Page) {
  await surface.route('**/api/v1/features', (route) =>
    route.fulfill({ json: { quoteComparisonEnabled: true } }),
  );
  await surface.route('**/api/v1/dashboard/overview?*', (route) =>
    route.fulfill({ json: emptyOverview }),
  );
  await surface.route('**/api/v1/shipments/search?*', (route) =>
    route.fulfill({ json: emptyShipments }),
  );
  await surface.route('**/api/v1/carriers', (route) => route.fulfill({ json: [] }));
  await surface.route('**/api/v1/sales-reps', (route) => route.fulfill({ json: [] }));
  await surface.addInitScript(() => {
    const sources = new Set<FixtureSource>();
    window.liveFixture = {
      active: 0,
      created: 0,
      peak: 0,
      emit: (type, data = {}) => {
        for (const source of sources)
          source.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }));
      },
      disconnect: () => {
        for (const source of sources) {
          source.readyState = 0;
          source.dispatchEvent(new Event('error'));
        }
      },
    };
    class FixtureSource extends EventTarget {
      readyState = 1;
      private timer: ReturnType<typeof setInterval>;
      constructor() {
        super();
        sources.add(this);
        window.liveFixture.created++;
        window.liveFixture.active = sources.size;
        window.liveFixture.peak = Math.max(window.liveFixture.peak, sources.size);
        queueMicrotask(() => this.dispatchEvent(new MessageEvent('resync', { data: '{}' })));
        this.timer = setInterval(
          () => this.dispatchEvent(new MessageEvent('heartbeat', { data: '{}' })),
          15_000,
        );
      }
      close() {
        this.readyState = 2;
        clearInterval(this.timer);
        sources.delete(this);
        window.liveFixture.active = sources.size;
      }
    }
    window.EventSource = FixtureSource as unknown as typeof EventSource;
  });
}
