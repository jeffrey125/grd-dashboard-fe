import type { z } from 'zod';
import type { adminSalesRepSchema } from './schemas';

export type AdminSalesRep = z.infer<typeof adminSalesRepSchema>;
