import { z } from 'zod';

export const advanceTypes = ['Chi tạm ứng', 'Phiếu tạm ứng', 'Chi trực tiếp'] as const;

export const advanceVoucherSchema = z.object({
  sheetId: z.number().int().optional().nullable(),
  type: z.enum(advanceTypes),
  advanceDate: z.coerce.date(),
  currency: z.enum(['VND', 'USD']).default('VND'),
  customerId: z.number().int().optional().nullable(),
  orderFrom: z.string().optional().nullable(),
  orderTo: z.string().optional().nullable(),
  containerQty: z.number().int().optional().nullable(),
  qty: z.coerce.number().optional().nullable(),
  note: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  // Chi tạm ứng bắt buộc phải chọn Job
  if (data.type.toLowerCase().includes('tạm ứng') && (data.sheetId == null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sheetId'], message: 'Chi tạm ứng bắt buộc phải chọn Job' });
  }
});

export type AdvanceVoucherInput = z.infer<typeof advanceVoucherSchema>;

export const advanceItemSchema = z.object({
  amount: z.coerce.number(),
  note: z.string().optional().nullable(),
});

export type AdvanceItemInput = z.infer<typeof advanceItemSchema>;

export const listAdvanceVouchersQuery = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  type: z.string().optional(),
  customerId: z.coerce.number().int().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const batchAdvanceVouchersQuery = z.object({
  ids: z.string().min(1, 'Thiếu danh sách phiếu'),
});

export const exportAdvanceVouchersQuery = z.object({
  search: z.string().optional(),
  type: z.string().optional(),
  customerId: z.coerce.number().int().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  ids: z.string().optional(),
});