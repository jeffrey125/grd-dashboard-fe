import { SalesRepsPage } from '@features/sales-reps';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/admin/sales-reps/')({ component: SalesRepsPage });
