import { z } from 'zod';

export const LEAVE_TYPES = ['Nghỉ phép năm', 'Nghỉ ốm', 'Nghỉ việc riêng', 'Nghỉ thai sản', 'Nghỉ khác'] as const;
export const LEAVE_STATUSES = ['pending', 'approved', 'rejected'] as const;

const dateOnly = z.coerce.date();

export const leaveRequestSchema = z.object({
  type: z.enum(LEAVE_TYPES),
  fromDate: dateOnly,
  toDate: dateOnly,
  reason: z.string().max(500, 'Lý do tối đa 500 ký tự').optional().nullable(),
}).refine((d) => d.toDate >= d.fromDate, { message: 'Ngày kết thúc phải sau ngày bắt đầu', path: ['toDate'] });

export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;

export const listLeaveRequestsQuery = z.object({
  status: z.enum(LEAVE_STATUSES).optional(),
  userId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const approveLeaveSchema = z.object({
  approveNote: z.string().max(500, 'Ghi chú tối đa 500 ký tự').optional().nullable(),
});
