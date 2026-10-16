import { urlSearch } from '@lib/url-search';
import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';

import { routeTree } from './route-tree.gen';
import { TrackingReview } from './tracking-review';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

export const router = createRouter({
  routeTree,
  ...urlSearch,
  context: { queryClient },
  InnerWrap: TrackingReview,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
