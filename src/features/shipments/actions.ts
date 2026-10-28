import { SessionCancelled, safeError } from '@api/api';
import { useNotifications } from '@components/feedback/notification-provider';
import { useSession } from '@features/auth';
import { businessCalendarDate } from '@lib/dates';
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { shipmentCommand } from './api';
import type { Shipment, TrackingRun } from './schemas';

export function actionRules(row: Shipment) {
  if (row.carrier.code === 'other')
    return { refresh: 'Updated manually by staff.', pause: false, resume: false };
  const completed = row.monitoringStatus === 'completed';
  const expired =
    !!row.currentTracking?.deliveredOn &&
    (!row.followUpOn || row.followUpOn <= businessCalendarDate());
  const manual = row.monitoringStatus === 'paused' && row.monitoringReason === 'manual';
  return {
    refresh:
      completed || expired
        ? 'Set a future follow-up date to monitor this delivered shipment.'
        : manual
          ? 'Resume monitoring before refreshing.'
          : !row.carrier.isActive
            ? 'Carrier is disabled.'
            : undefined,
    pause: row.monitoringStatus === 'active',
    resume: manual && !expired,
  };
}
export function useShipmentCommand(
  id: string,
  options?: {
    onRefresh?: (run: TrackingRun) => void;
    onMissing?: () => void;
  },
) {
  const { session } = useSession();
  const queries = useQueryClient();
  const { showNotification } = useNotifications();
  const busy = useRef(false);
  const pending = useIsMutating({ mutationKey: ['shipment-command', id] }) > 0;
  const mutation = useMutation({
    mutationKey: ['shipment-command', id],
    mutationFn: ({ row, command }: { row: Shipment; command: 'pause' | 'resume' | 'refresh' }) =>
      shipmentCommand(session.client, row.externalId, command),
    retry: false,
    onSuccess: (result, { row, command }) => {
      if (command === 'refresh' && 'status' in result) options?.onRefresh?.(result);
      const message =
        command === 'refresh'
          ? 'status' in result && ['queued', 'running'].includes(result.status)
            ? `${row.trackingReference}: refresh queued or joined an existing run. Tracking is not confirmed yet.`
            : `${row.trackingReference}: refresh request returned a finished run. Check the latest lookup for its outcome.`
          : `${row.trackingReference}: monitoring ${command === 'pause' ? 'paused' : 'resumed'}.`;
      showNotification({ message, severity: 'success' });
    },
    onError: (error) => {
      if (safeError(error).status === 404) options?.onMissing?.();
      if (!(error instanceof SessionCancelled))
        showNotification({ message: safeError(error).message, severity: 'error' });
    },
    onSettled: (_data, error, { row }) => {
      busy.current = false;
      if (error instanceof SessionCancelled) return;
      // Refetch even after conflicts: the action's eligibility may have changed remotely.
      void queries.invalidateQueries({ queryKey: ['shipments'] });
      void queries.invalidateQueries({ queryKey: ['shipment', row.externalId] });
      void queries.invalidateQueries({ queryKey: ['overview'] });
    },
  });
  return {
    pending,
    execute: (row: Shipment, command: 'pause' | 'resume' | 'refresh') => {
      if (busy.current || pending) return;
      busy.current = true;
      mutation.mutate({ row, command });
    },
  };
}
