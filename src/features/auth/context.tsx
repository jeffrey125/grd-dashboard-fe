import { createContext, type ReactNode, useContext, useEffect, useSyncExternalStore } from 'react';
import type { Session } from './session';

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ session, children }: { session: Session; children: ReactNode }) {
  useEffect(() => session.start(), [session]);
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('SessionProvider is required.');
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return { session, ...state };
}
