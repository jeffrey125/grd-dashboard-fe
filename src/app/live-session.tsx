import { useSession } from '@features/auth';
import { LiveUpdates, LiveUpdatesContext } from '@features/tracking-updates';
import { type ReactNode, useEffect, useState, useSyncExternalStore } from 'react';

export function LiveSession({ children }: { children: ReactNode }) {
  const { session, status } = useSession();
  const [live] = useState(
    () => new LiveUpdates(`${session.client.baseUrl}/events`, session.queries, session.recheck),
  );
  const { started } = useSyncExternalStore(live.subscribe, live.getSnapshot);
  useEffect(() => {
    const reconcile = () => {
      if (session.getSnapshot().status === 'authenticated') live.start();
      else live.stop();
    };
    const unregister = session.registerCleanup(live.stop);
    const unsubscribe = session.subscribe(reconcile);
    reconcile();
    return () => {
      unregister();
      unsubscribe();
      live.stop();
    };
  }, [session, live]);

  // Mount protected query consumers only after the stream's listeners are attached.
  if (status === 'authenticated' && !started) return null;
  return <LiveUpdatesContext.Provider value={live}>{children}</LiveUpdatesContext.Provider>;
}
