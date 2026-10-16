import { AccountDetailPage } from '@features/accounts';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { z } from 'zod';
export const Route = createFileRoute('/admin/accounts/$accountId')({
  beforeLoad: ({ params }) => {
    if (!z.uuidv4().safeParse(params.accountId).success) throw notFound();
  },
  component: AccountDetailPage,
});
