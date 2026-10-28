import { z } from 'zod';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

export const monitoringScopeSchema = z.enum(['mine', 'everyone']);
export type MonitoringScope = z.infer<typeof monitoringScopeSchema>;
export const monitoringScopeStorageKey = 'grd-monitoring-scope-v1';
const preferencesSchema = z.object({ scopes: z.record(z.uuid(), monitoringScopeSchema) });

type ScopeState = {
  scopes: Record<string, MonitoringScope>;
  setScope: (accountId: string, scope: MonitoringScope) => void;
};

// Storage restrictions must not prevent switching views in the current session.
const browserStorage: StateStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* In-memory state remains usable. */
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* Storage may be disabled. */
    }
  },
};

export function createMonitoringScopeStore(storage: StateStorage = browserStorage) {
  return createStore<ScopeState>()(
    persist(
      (set) => ({
        scopes: {},
        setScope: (accountId, scope) =>
          set((state) => ({
            scopes: { ...state.scopes, [accountId]: scope },
          })),
      }),
      {
        name: monitoringScopeStorageKey,
        version: 1,
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({ scopes: state.scopes }),
        merge: (persisted, current) => {
          const parsed = preferencesSchema.safeParse(persisted);
          return parsed.success ? { ...current, scopes: parsed.data.scopes } : current;
        },
      },
    ),
  );
}

export const monitoringScopeStore = createMonitoringScopeStore();
