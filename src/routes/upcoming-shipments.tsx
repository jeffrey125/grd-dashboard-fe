import { UpcomingPage } from '@features/upcoming-shipments';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/upcoming-shipments')({ component: UpcomingPage });
