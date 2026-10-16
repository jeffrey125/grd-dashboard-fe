import { CreateAccountPage } from '@features/accounts';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/admin/accounts/new')({ component: CreateAccountPage });
