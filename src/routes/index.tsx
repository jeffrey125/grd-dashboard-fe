import { OverviewPage } from '@features/overview';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: OverviewPage,
});
