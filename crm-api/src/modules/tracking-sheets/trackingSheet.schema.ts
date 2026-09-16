import { z } from 'zod';

export const trackingSheetSchema = z.object({
  docStaffId: z.number().int().positive().optional().nullable(),
  deliveryStaffId: z.number().int().positive().optional().nullable(),
  nw: z.coerce.number().nonnegative().optional().nullable(),
  containerNumber: z.string().optional().nullable(),
  customerId: z.number().int().positive().optional().nullable(),
  carrierId: z.coerce.number().int().positive().optional().nullable(),
  agentId: z.coerce.number().int().positive().optional().nullable(),
  fromLocation: z.string().optional().nullable(),
  toLocation: z.string().optional().nullable(),
  containerQuantity: z.string().optional().nullable(),
  etaDate: z.coerce.date().optional().nullable(),
  gw: z.coerce.number().nonnegative().optional().nullable(),
  customNo: z.string().optional().nullable(),
  declarationDate: z.coerce.date().optional().nullable(),
  billNumber: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  pol: z.string().optional().nullable(),
  pod: z.string().optional().nullable(),
  phanLuong: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export type TrackingSheetInput = z.infer<typeof trackingSheetSchema>;

export const jobOrderSchema = z.object({
  type: z.string().min(1, 'Chọn loại'),
  description: z.string().optional().nullable(),
  portAmt: z.coerce.number().optional().nullable(),
  industry: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export type JobOrderInput = z.infer<typeof jobOrderSchema>;

export const jobBookingSchema = z.object({
  type: z.string().min(1, 'Chọn loại'),
  description: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  quantity: z.coerce.number().optional().nullable(),
  pretaxAmount: z.coerce.number().optional().nullable(),
  taxRate: z.coerce.number().optional().nullable(),
  taxAmount: z.coerce.number().optional().nullable(),
  afterTaxAmount: z.coerce.number().optional().nullable(),
  total: z.coerce.number().optional().nullable(),
});

export type JobBookingInput = z.infer<typeof jobBookingSchema>;

export const debitNoteSchema = z.object({
  type: z.string().min(1, 'Chọn loại'),
  invoiceNumber: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  currency: z.enum(['VND', 'USD']).default('VND'),
  quantity: z.coerce.number().optional().nullable(),
  priceVnd: z.coerce.number().optional().nullable(),
  taxRate: z.coerce.number().optional().nullable(),
  priceUsd: z.coerce.number().optional().nullable(),
  exchangeRate: z.coerce.number().optional().nullable(),
  total: z.coerce.number().optional().nullable(),
});

export type DebitNoteInput = z.infer<typeof debitNoteSchema>;

export const listTrackingSheetsQuery = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const batchTrackingSheetsQuery = z.object({
  ids: z.string().min(1, 'Thiếu danh sách phiếu'),
});

export const exportTrackingSheetsQuery = z.object({
  search: z.string().optional(),
  customerId: z.coerce.number().int().positive().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const exportJobsQuery = z.object({
  type: z.enum(['order', 'booking', 'debit']),
});