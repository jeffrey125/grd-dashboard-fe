import { ShipmentPlaceholder } from '@features/shipments/pages/placeholder-page';
import { listReturnTo } from '@features/shipments/search-state';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/shipments/new')({
  validateSearch: (raw) => ({ returnTo: listReturnTo(raw.returnTo) }),
  component: ShipmentPlaceholder,
});
