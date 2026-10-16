import { ChangePasswordPage, safeReturnTo } from '@features/auth';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/change-password')({
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: safeReturnTo(search.returnTo),
  }),
  component: ChangePasswordPage,
});
