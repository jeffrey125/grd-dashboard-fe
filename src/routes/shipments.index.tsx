import { ShipmentsPage } from '@features/shipments';
import { readSearch } from '@features/shipments/search-state';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/shipments/')({
  validateSearch: readSearch,
  component: ShipmentsPage,
});
