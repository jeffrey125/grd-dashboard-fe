import { ShipmentDetailPage } from '@features/shipments';
import { detailSearch } from '@features/shipments/history-model';
import { createFileRoute, notFound, type SearchSchemaInput } from '@tanstack/react-router';
import { z } from 'zod';
export const Route = createFileRoute('/shipments/$shipmentId')({
  validateSearch: (raw: Record<string, unknown> & SearchSchemaInput) => detailSearch(raw),
  beforeLoad: ({ params }) => {
    if (!z.uuidv4().safeParse(params.shipmentId).success) throw notFound();
  },
  component: ShipmentDetailPage,
});
