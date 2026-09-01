import { z } from 'zod';

export const truckerSchema = z.object({
  truckerName: z.string().min(2, 'Tên nhà xe tối thiểu 2 ký tự'),
  companyName: z.string().min(2, 'Tên đơn vị tối thiểu 2 ký tự'),
  contactPerson: z.string().optional().nullable(),
  taxCode: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  fax: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export type TruckerInput = z.infer<typeof truckerSchema>;

export const listTruckersQuery = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});