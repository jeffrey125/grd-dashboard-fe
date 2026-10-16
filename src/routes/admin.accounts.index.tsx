import { AccountsPage, accountListSearch } from '@features/accounts';
import { createFileRoute, type SearchSchemaInput } from '@tanstack/react-router';
export const Route = createFileRoute('/admin/accounts/')({
  validateSearch: (raw: Record<string, unknown> & SearchSchemaInput) => accountListSearch(raw),
  component: AccountsPage,
});
