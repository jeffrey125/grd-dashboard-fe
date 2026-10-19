/** Events invalidate snapshots; serialized reads absorb duplicates and out-of-order hints. */
export function watchComparison(
  url: string,
  id: string,
  refresh: () => Promise<unknown>,
  recheck: () => Promise<void>,
  createSource = (address: string) => new EventSource(address, { withCredentials: true }),
) {
  let stopped = false;
  let dirty = false;
  let reading = false;
  let source: EventSource | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let unbind = () => {};

  const invalidate = async () => {
    if (stopped) return;
    dirty = true;
    if (reading) return;
    reading = true;
    try {
      while (dirty && !stopped) {
        dirty = false;
        try {
          await refresh();
        } catch {
          /* Query owns the safe visible read error. */
        }
      }
    } finally {
      reading = false;
    }
  };
  const reconnect = () => {
    unbind();
    source?.close();
    if (stopped || retry !== undefined) return;
    retry = setTimeout(async () => {
      try {
        await recheck();
      } catch {
        /* Session owns auth failure. */
      }
      retry = undefined;
      if (!stopped) connect();
    }, 2000);
  };
  const connect = () => {
    try {
      source = createSource(url);
      const current = source;
      const changed = (message: Event) => {
        try {
          const payload = JSON.parse((message as MessageEvent<string>).data) as {
            externalId?: unknown;
          };
          if (payload.externalId === id) void invalidate();
        } catch {
          /* Untrusted event payloads cannot change cache keys or records. */
        }
      };
      const sync = () => {
        void invalidate();
      };
      current.addEventListener('open', sync);
      current.addEventListener('resync', sync);
      current.addEventListener('quote.changed', changed);
      current.addEventListener('error', reconnect);
      unbind = () => {
        current.removeEventListener('open', sync);
        current.removeEventListener('resync', sync);
        current.removeEventListener('quote.changed', changed);
        current.removeEventListener('error', reconnect);
      };
    } catch {
      reconnect();
    }
  };
  connect();

  return () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(retry);
    unbind();
    source?.close();
  };
}
