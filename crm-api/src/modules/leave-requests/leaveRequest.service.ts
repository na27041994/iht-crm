import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import type { LeaveRequestInput } from './leaveRequest.schema.js';

// Số ngày nghỉ (bao cả ngày đầu + cuối)
export function calcLeaveDays(from: Date, to: Date): number {
  const ms = new Date(to).setHours(0, 0, 0, 0) - new Date(from).setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000) + 1;
}

const include = {
  user: { select: { id: true, fullName: true, email: true } },
  approver: { select: { id: true, fullName: true } },
};

// Danh sách: có quyền edit -> xem tất cả (để duyệt), còn lại chỉ xem đơn của mình
export async function listLeaveRequests(
  viewerId: number,
  canViewAll: boolean,
  opts: { status?: string; userId?: number; page?: number; pageSize?: number } = {},
) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(Math.max(opts.pageSize ?? 20, 1), 100);
  const where: Prisma.LeaveRequestWhereInput = { isDelete: 1 };
  if (!canViewAll) {
    where.userId = viewerId;
  } else if (opts.userId) {
    where.userId = opts.userId;
  }
  if (opts.status) where.status = opts.status;

  const [total, items] = await Promise.all([
    prisma.leaveRequest.count({ where }),
    prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include,
    }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// Tạo đơn: người xin = chính mình
export async function createLeaveRequest(userId: number, input: LeaveRequestInput) {
  return prisma.leaveRequest.create({
    data: {
      userId,
      type: input.type,
      fromDate: input.fromDate,
      toDate: input.toDate,
      days: calcLeaveDays(input.fromDate, input.toDate),
      reason: input.reason?.trim() ? input.reason.trim() : null,
      status: 'pending',
    },
    include,
  });
}

// Sửa đơn: chỉ đơn chờ duyệt; chủ đơn hoặc người có quyền edit
export async function updateLeaveRequest(id: number, viewerId: number, canEditAll: boolean, input: LeaveRequestInput) {
  const existing = await prisma.leaveRequest.findFirst({ where: { id, isDelete: 1 } });
  if (!existing) throw new AppError('Không tìm thấy đơn nghỉ phép', 404);
  if (existing.status !== 'pending') throw new AppError('Đơn đã duyệt/từ chối, không được sửa', 400);
  if (existing.userId !== viewerId && !canEditAll) throw new AppError('Bạn không có quyền sửa đơn này', 403);
  return prisma.leaveRequest.update({
    where: { id },
    data: {
      type: input.type,
      fromDate: input.fromDate,
      toDate: input.toDate,
      days: calcLeaveDays(input.fromDate, input.toDate),
      reason: input.reason?.trim() ? input.reason.trim() : null,
    },
    include,
  });
}

// Xóa mềm đơn chờ duyệt
export async function deleteLeaveRequest(id: number, viewerId: number, canDeleteAll: boolean) {
  const existing = await prisma.leaveRequest.findFirst({ where: { id, isDelete: 1 } });
  if (!existing) throw new AppError('Không tìm thấy đơn nghỉ phép', 404);
  if (existing.status !== 'pending') throw new AppError('Đơn đã duyệt/từ chối, không được xóa', 400);
  if (existing.userId !== viewerId && !canDeleteAll) throw new AppError('Bạn không có quyền xóa đơn này', 403);
  return prisma.leaveRequest.update({ where: { id }, data: { isDelete: -1 } });
}

// Duyệt / từ chối: cần quyền edit, không được duyệt đơn của chính mình
export async function decideLeaveRequest(id: number, approverId: number, approve: boolean, note?: string | null) {
  const existing = await prisma.leaveRequest.findFirst({ where: { id, isDelete: 1 } });
  if (!existing) throw new AppError('Không tìm thấy đơn nghỉ phép', 404);
  if (existing.status !== 'pending') throw new AppError('Đơn đã được xử lý trước đó', 400);
  if (existing.userId === approverId) throw new AppError('Không được duyệt đơn của chính mình', 400);
  return prisma.leaveRequest.update({
    where: { id },
    data: {
      status: approve ? 'approved' : 'rejected',
      approvedById: approverId,
      approvedAt: new Date(),
      approveNote: note?.trim() ? note.trim() : null,
    },
    include,
  });
}
