import { useSession } from '@features/auth';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useEffect } from 'react';
import { useStore } from 'zustand';
import { monitoringScopeSchema, monitoringScopeStorageKey, monitoringScopeStore } from './store';

export type { MonitoringScope } from './store';

export function useMonitoringScope() {
  const { account } = useSession();
  const accountId = account?.externalId;
  const scope = useStore(monitoringScopeStore, (state) =>
    accountId ? (state.scopes[accountId] ?? 'mine') : 'mine',
  );
  useEffect(() => {
    void monitoringScopeStore.persist.rehydrate();
    const sync = (event: StorageEvent) => {
      if (event.key === monitoringScopeStorageKey) void monitoringScopeStore.persist.rehydrate();
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  return {
    scope,
    accountId,
    setScope: (value: unknown) => {
      const parsed = monitoringScopeSchema.safeParse(value);
      if (accountId && parsed.success)
        monitoringScopeStore.getState().setScope(accountId, parsed.data);
    },
  };
}

export function MonitoringScopeToggle({
  scope,
  onChange,
}: {
  scope: 'mine' | 'everyone';
  onChange: (value: unknown) => void;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      color="primary"
      value={scope}
      onChange={(_event, value: unknown) => onChange(value)}
      aria-label="Monitoring created by"
      sx={{ alignSelf: 'flex-start' }}
    >
      <ToggleButton value="mine">Personal</ToggleButton>
      <ToggleButton value="everyone">Team</ToggleButton>
    </ToggleButtonGroup>
  );
}
