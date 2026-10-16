import { NotificationProvider } from '@components/feedback/notification-provider';
import { SessionProvider, useSession } from '@features/auth';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { GrdThemeProvider } from '@theme/theme-provider';

import { queryClient, router } from './router';
import { session } from './session';

function SessionContent() {
  const { generation } = useSession();
  return (
    <NotificationProvider key={generation}>
      <RouterProvider router={router} />
    </NotificationProvider>
  );
}

export function AppProviders() {
  return (
    <GrdThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider session={session}>
          <SessionContent />
        </SessionProvider>
      </QueryClientProvider>
    </GrdThemeProvider>
  );
}
