import { QuotesPage } from '@features/shipping-quotes';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
export const Route = createFileRoute('/quotes/')({
  validateSearch: z.object({ page: z.coerce.number().int().min(1).catch(1) }),
  component: QuotesPage,
});
