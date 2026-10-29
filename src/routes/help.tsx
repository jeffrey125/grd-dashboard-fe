import { HelpPage } from '@features/help/help-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/help')({
  validateSearch: (search: Record<string, unknown>) => ({
    category: typeof search.category === 'string' ? search.category : 'getting-started',
  }),
  component: HelpPage,
});
