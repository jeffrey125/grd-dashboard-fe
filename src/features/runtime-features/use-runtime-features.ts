import type { ApiClient } from '@api/api';
import { useQuery } from '@tanstack/react-query';
import { getRuntimeFeatures } from './api';

export function useRuntimeFeatures(client: ApiClient, enabled: boolean) {
  return useQuery({
    queryKey: ['runtime-features'],
    queryFn: ({ signal }) => getRuntimeFeatures(client, signal),
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: 1,
  });
}
