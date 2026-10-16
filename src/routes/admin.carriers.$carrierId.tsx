import { CarrierDetailPage } from '@features/carriers';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { z } from 'zod';
export const Route = createFileRoute('/admin/carriers/$carrierId')({
  beforeLoad: ({ params }) => {
    if (!z.uuidv4().safeParse(params.carrierId).success) throw notFound();
  },
  component: CarrierDetailPage,
});
