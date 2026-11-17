import { UpcomingPage } from '@features/upcoming-shipments';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/admin/upcoming-shipments')({
  component: () => <UpcomingPage admin />,
});
