import { CarriersPage } from '@features/carriers';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/admin/carriers/')({ component: CarriersPage });
