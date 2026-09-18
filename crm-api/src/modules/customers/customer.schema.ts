import { z } from 'zod';

export const CUSTOMER_TYPES = ['KH', 'DL'] as const;

export const customerSchema = z.object({
  customerType: z.enum(CUSTOMER_TYPES).default('KH'),
  customerName: z.string().min(2, 'Tên khách hàng tối thiểu 2 ký tự'),
  companyName: z.string().min(2, 'Tên đơn vị tối thiểu 2 ký tự'),
  contactPerson: z.string().optional().nullable(),
  taxCode: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  fax: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export const listCustomersQuery = z.object({
  search: z.string().optional(),
  customerType: z.enum(CUSTOMER_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
