import { NewQuotePage } from '@features/shipping-quotes';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
export const Route = createFileRoute('/quotes/new')({
  validateSearch: z.object({ copy: z.uuidv4().optional().catch(undefined) }),
  component: NewQuotePage,
});
