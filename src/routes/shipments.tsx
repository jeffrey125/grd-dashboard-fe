import { ShipmentsPage } from '@features/shipments';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/shipments')({
  component: ShipmentsPage,
});
