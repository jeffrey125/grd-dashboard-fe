import { useSession } from '@features/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getComparison } from './api';
import { watchComparison } from './quote-live';

export function useComparison(id: string) {
  const { session, status, generation } = useSession();
  const queries = useQueryClient();
  const query = useQuery({
    queryKey: ['quote-comparison', id],
    queryFn: ({ signal }) => getComparison(session.client, id, signal),
    enabled: status === 'authenticated',
    refetchInterval: (query) =>
      !query.state.data || ['queued', 'running'].includes(query.state.data.status) ? 15000 : false,
    refetchIntervalInBackground: true,
  });
  const active = !query.data || ['queued', 'running'].includes(query.data.status);

  useEffect(() => {
    if (status !== 'authenticated' || !active) return;
    let stopped = false;
    const stopStream = watchComparison(
      `${session.client.baseUrl}/quote-comparisons/${id}/events`,
      id,
      async () => {
        const queryKey = ['quote-comparison', id];
        await queries.cancelQueries({ queryKey, exact: true });
        if (stopped || session.getSnapshot().generation !== generation) return;
        await queries.fetchQuery({
          queryKey,
          queryFn: ({ signal }) => getComparison(session.client, id, signal),
          staleTime: 0,
        });
        if (!stopped) await queries.invalidateQueries({ queryKey: ['quote-comparisons'] });
      },
      () => session.recheck(),
    );
    const stop = () => {
      stopped = true;
      stopStream();
    };
    const unregister = session.registerCleanup(stop);
    return () => {
      stop();
      unregister();
    };
  }, [id, session, status, generation, queries, active]);

  return query;
}
