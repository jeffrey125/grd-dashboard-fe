import { ApiError } from '@api/api';
import { useSession } from '@features/auth';
import { getShipment } from '@features/shipments';
import { LiveUpdatesContext, TrackingReviewProvider } from '@features/tracking-updates';
import { type ReactNode, useCallback, useContext } from 'react';

const isMissing = (error: unknown) => error instanceof ApiError && error.status === 404;

export function TrackingReview({ children }: { children: ReactNode }) {
  const { session, account, status, generation } = useSession();
  const live = useContext(LiveUpdatesContext);
  const readCurrent = useCallback(
    async (id: string, signal: AbortSignal) => {
      const shipment = await getShipment(session.client, id, signal);
      return shipment.currentTracking?.externalId ?? null;
    },
    [session],
  );
  if (!account || status !== 'authenticated' || !live) return <>{children}</>;
  return (
    <TrackingReviewProvider
      key={`${account.externalId}:${generation}`}
      accountId={account.externalId}
      live={live}
      readCurrent={readCurrent}
      isMissing={isMissing}
    >
      {children}
    </TrackingReviewProvider>
  );
}
