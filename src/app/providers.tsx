import { NotificationProvider } from '@components/feedback/notification-provider';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { GrdThemeProvider } from '@theme/theme-provider';

import { queryClient, router } from './router';

export function AppProviders() {
  return (
    <GrdThemeProvider>
      <NotificationProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </NotificationProvider>
    </GrdThemeProvider>
  );
}
