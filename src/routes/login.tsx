import { LoginPage, safeReturnTo } from '@features/auth';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: safeReturnTo(search.returnTo),
  }),
  component: LoginPage,
});
