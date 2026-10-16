import { SessionCancelled, safeError } from '@api/api';
import { useCooldown, useSession } from '@features/auth';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

/** Local async state intentionally avoids putting issued passwords in MutationCache. */
export function useAccountWrite() {
  const { session } = useSession();
  const queries = useQueryClient();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const remaining = useCooldown(retryAt);
  async function run(action: () => Promise<void>) {
    const before = session.getSnapshot();
    if (
      busy.current ||
      Date.now() < retryAt ||
      before.status !== 'authenticated' ||
      before.account?.role !== 'admin'
    )
      return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await action();
    } catch (failure) {
      if (
        !(failure instanceof SessionCancelled) &&
        before.generation === session.getSnapshot().generation
      ) {
        const normalized = safeError(failure);
        setError(normalized.message);
        setRetryAt(normalized.retryAt);
        if ([404, 409].includes(normalized.status))
          void queries.invalidateQueries({ queryKey: ['accounts'] });
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return { run, pending, error, remaining, clear: () => setError('') };
}
