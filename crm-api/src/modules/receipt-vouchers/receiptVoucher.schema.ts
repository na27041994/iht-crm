import { z } from 'zod';

export const receiptPayerTypes = ['Khách Hàng', 'Cá nhân'] as const;

// Tien nhap hien thi (VND), service scale x100 truoc khi luu
export const receiptVoucherSchema = z.object({
  payerType: z.enum(receiptPayerTypes),
  receiptDate: z.coerce.date(),
  currency: z.enum(['VND', 'USD']).default('VND'),
  customerId: z.number().int().optional().nullable(),
  payerName: z.string().optional().nullable(),
  staffId: z.number().int().optional().nullable(),
  amount: z.coerce.number().min(0, 'Số tiền phải >= 0'),
  transFee: z.coerce.number().min(0).optional().nullable(),
  note: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  // Khách Hàng bắt buộc chọn khách, Cá nhân bắt buộc nhập tên người nộp
  if (data.payerType === 'Khách Hàng' && data.customerId == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customerId'], message: 'Khách Hàng bắt buộc phải chọn khách hàng' });
  }
  if (data.payerType === 'Cá nhân' && (data.payerName == null || data.payerName.trim() === '')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['payerName'], message: 'Cá nhân bắt buộc phải nhập tên người nộp' });
  }
});

export type ReceiptVoucherInput = z.infer<typeof receiptVoucherSchema>;

export const listReceiptVouchersQuery = z.object({
  search: z.string().optional(),
  payerType: z.string().optional(),
  customerId: z.coerce.number().int().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const batchReceiptVouchersQuery = z.object({
  ids: z.string().min(1, 'Thiếu danh sách phiếu'),
});

export const exportReceiptVouchersQuery = z.object({
  search: z.string().optional(),
  payerType: z.string().optional(),
  customerId: z.coerce.number().int().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  ids: z.string().optional(),
});
