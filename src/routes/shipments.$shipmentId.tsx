import { ShipmentPlaceholder } from '@features/shipments/pages/placeholder-page';
import { listReturnTo } from '@features/shipments/search-state';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { z } from 'zod';
export const Route = createFileRoute('/shipments/$shipmentId')({
  validateSearch: (raw) => ({ returnTo: listReturnTo(raw.returnTo) }),
  beforeLoad: ({ params }) => {
    if (!z.uuidv4().safeParse(params.shipmentId).success) throw notFound();
  },
  component: () => <ShipmentPlaceholder detail />,
});
