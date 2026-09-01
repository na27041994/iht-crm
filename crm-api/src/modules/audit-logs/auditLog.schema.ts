import { z } from 'zod';

export const listAuditLogsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  userId: z.coerce.number().int().positive().optional(),
  action: z.string().optional(),
  entity: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});