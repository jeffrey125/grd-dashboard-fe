import { describe, expect, it, vi } from 'vitest';
import { watchComparison } from './quote-live';

describe('Comparison event hints', () => {
  it('rechecks the session before reconnecting and stops during a pending recheck', async () => {
    vi.useFakeTimers();
    const sources: Array<EventTarget & { close: ReturnType<typeof vi.fn>; readyState: number }> =
      [];
    const create = () => {
      const source = Object.assign(new EventTarget(), { close: vi.fn(), readyState: 1 });
      sources.push(source);
      return source as unknown as EventSource;
    };
    const refresh = vi.fn().mockResolvedValue(undefined);
    let release!: () => void;
    const recheck = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      );
    const stop = watchComparison('/events', 'comparison', refresh, recheck, create);
    try {
      const first = sources[0];
      if (!first) throw new Error('Initial source missing');
      first.dispatchEvent(new Event('error'));
      expect(first.close).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(2000);
      expect(recheck).toHaveBeenCalledOnce();
      expect(sources).toHaveLength(2);
      const second = sources[1];
      if (!second) throw new Error('Replacement source missing');
      second.dispatchEvent(new Event('open'));
      await Promise.resolve();
      expect(refresh).toHaveBeenCalledOnce();
      second.dispatchEvent(new Event('error'));
      await vi.advanceTimersByTimeAsync(2000);
      stop();
      release();
      await Promise.resolve();
      expect(sources).toHaveLength(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      stop();
      vi.useRealTimers();
    }
  });
  it('refetches after connection and again for changes arriving during a read, and closes on teardown', async () => {
    const source = Object.assign(new EventTarget(), { close: vi.fn(), readyState: 1 });
    let release!: () => void;
    const refresh = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const stop = watchComparison(
      'http://localhost/events',
      'comparison',
      refresh,
      async () => undefined,
      () => source as unknown as EventSource,
    );
    source.dispatchEvent(new Event('open'));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    source.dispatchEvent(
      new MessageEvent('quote.changed', { data: JSON.stringify({ externalId: 'comparison' }) }),
    );
    source.dispatchEvent(
      new MessageEvent('quote.changed', { data: JSON.stringify({ externalId: 'comparison' }) }),
    );
    release();
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
    source.dispatchEvent(new Event('open'));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(3));
    stop();
    source.dispatchEvent(new Event('open'));
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(source.close).toHaveBeenCalledOnce();
  });
});
