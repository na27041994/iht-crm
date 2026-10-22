import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import { toScaled } from '../../lib/money.js';
import { hasPermission } from '../permissions/permissions.service.js';
import type { AdvanceVoucherInput, AdvanceItemInput } from './advanceVoucher.schema.js';

const EDITABLE_STATUSES: string[] = ['draft', 'rejected'];

async function getActor(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
  if (!user) throw new AppError('Không tìm thấy người dùng', 404);
  return user;
}

async function writeLog(
  voucherId: number,
  action: string,
  fromStatus: string | null,
  toStatus: string | null,
  byId: number,
  byName: string,
  note?: string | null,
) {
  await prisma.advanceVoucherLog.create({
    data: { voucherId, action, fromStatus, toStatus, byId, byName, note: note?.trim() ? note.trim() : null },
  });
}

// Chỉ phiếu nháp / bị từ chối mới được sửa, xóa, thêm bớt khoản
async function requireEditableVoucher(id: number) {
  const voucher = await prisma.advanceVoucher.findFirst({ where: { id, isDelete: 1 } });
  if (!voucher) throw new AppError('Không tìm thấy phiếu chi tạm ứng', 404);
  if (!EDITABLE_STATUSES.includes(voucher.approvalStatus)) {
    throw new AppError('Phiếu đang chờ duyệt/đã duyệt nên không được sửa. Cần mở khóa trước.', 400);
  }
  return voucher;
}

function scaleAdvanceItem(input: AdvanceItemInput): AdvanceItemInput {
  return { ...input, amount: toScaled(input.amount as unknown as number) as unknown as number ?? input.amount };
}

// Tổng net = SUM(Chi) - SUM(Giảm trừ), amount luôn dương
function netAmount(item: { amount: unknown; kind?: unknown }): number {
  const v = Number((item as any).amount ?? 0);
  return (item as any).kind === 'Giảm trừ' ? -v : v;
}

const include = {
  sheet: { select: { id: true, sheetNumber: true } },
  customer: { select: { id: true, customerName: true, companyName: true } },
  createdBy: { select: { id: true, fullName: true } },
  advanceStaff: { select: { id: true, fullName: true } },
  items: { where: { isDelete: 1 }, orderBy: { id: 'asc' } },
} satisfies Prisma.AdvanceVoucherInclude;

const detailInclude = {
  ...include,
  logs: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.AdvanceVoucherInclude;

// Sinh mã phiếu chi mới theo ngày YYMMDDxxx
async function nextAdvanceNo(now = new Date()) {
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 86400000);
  const count = await prisma.advanceVoucher.count({
    where: { createdAt: { gte: start, lt: end } },
  });
  return `${y}${m}${d}${String(count + 1).padStart(3, '0')}`;
}

// Liệt kê phiếu chi có lọc theo loại/khách/ngày
export async function listAdvanceVouchers(opts: {
  search?: string;
  type?: string;
  customerId?: number;
  from?: Date;
  to?: Date;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const { search, type, customerId, from, to, status, page = 1, pageSize = 20 } = opts;
  const where: Prisma.AdvanceVoucherWhereInput = { isDelete: 1 };
  if (status === 'pending') where.approvalStatus = { in: ['pending_dept', 'pending_accountant'] };
  else if (status) where.approvalStatus = status;
  if (search) {
    where.OR = [
      { advanceNo: { contains: search, mode: 'insensitive' } },
      { type: { contains: search, mode: 'insensitive' } },
      { customer: { is: { companyName: { contains: search, mode: 'insensitive' } } } },
      { sheet: { is: { sheetNumber: { contains: search, mode: 'insensitive' } } } },
    ];
  }
  if (type) where.type = type;
  if (customerId) where.customerId = customerId;
  if (from || to) {
    where.advanceDate = {};
    if (from) where.advanceDate.gte = from;
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      where.advanceDate.lte = end;
    }
  }

  const [total, rows] = await Promise.all([
    prisma.advanceVoucher.count({ where }),
    prisma.advanceVoucher.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include,
    }),
  ]);

  const items = rows.map((row) => ({
    ...row,
    totalAmount: row.items.reduce((sum, item) => sum + netAmount(item), 0),
  }));

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// Liệt kê phiếu chi (legacy) - gọi listAdvanceVouchers
export async function listAdvanceVouchersLegacy(search?: string, page = 1, pageSize = 20) {
  return listAdvanceVouchers({ search, page, pageSize });
}

// Đếm số phiếu đang chờ duyệt / chờ chi / chờ nhận để hiện badge menu
export async function countAdvancePending() {
  const [pendingApproval, pendingPay, pendingReceive] = await Promise.all([
    prisma.advanceVoucher.count({ where: { isDelete: 1, approvalStatus: { in: ['pending_dept', 'pending_accountant'] } } }),
    prisma.advanceVoucher.count({ where: { isDelete: 1, approvalStatus: 'approved' } }),
    prisma.advanceVoucher.count({ where: { isDelete: 1, approvalStatus: 'paid' } }),
  ]);
  return { pendingApproval, pendingPay, pendingReceive };
}

// Lấy nhiều phiếu chi theo ids để in/batch
export async function getAdvanceVouchersByIds(ids: number[]) {
  if (!ids.length) return [];
  return prisma.advanceVoucher.findMany({
    where: { id: { in: ids }, isDelete: 1 },
    include,
    orderBy: { id: 'asc' },
  });
}

// Lấy phiếu chi để xuất Excel
export async function getAdvanceVouchersForExport(opts: {
  search?: string;
  type?: string;
  customerId?: number;
  from?: Date;
  to?: Date;
  ids?: number[];
}) {
  const where: Prisma.AdvanceVoucherWhereInput = { isDelete: 1 };
  if (opts.ids?.length) {
    where.id = { in: opts.ids };
  } else {
    if (opts.search) {
      where.OR = [
        { advanceNo: { contains: opts.search, mode: 'insensitive' } },
        { type: { contains: opts.search, mode: 'insensitive' } },
        { customer: { is: { companyName: { contains: opts.search, mode: 'insensitive' } } } },
        { sheet: { is: { sheetNumber: { contains: opts.search, mode: 'insensitive' } } } },
      ];
    }
    if (opts.type) where.type = opts.type;
    if (opts.customerId) where.customerId = opts.customerId;
    if (opts.from || opts.to) {
      where.advanceDate = {};
      if (opts.from) where.advanceDate.gte = opts.from;
      if (opts.to) {
        const end = new Date(opts.to);
        end.setHours(23, 59, 59, 999);
        where.advanceDate.lte = end;
      }
    }
  }
  const rows = await prisma.advanceVoucher.findMany({ where, orderBy: { id: 'asc' }, include });
  return rows.map((row) => ({
    ...row,
    totalAmount: row.items.reduce((sum, item) => sum + netAmount(item), 0),
  }));
}

// Lấy chi tiết một phiếu chi và tính tổng tiền (net = Chi - Giảm trừ)
export async function getAdvanceVoucher(id: number) {
  const voucher = await prisma.advanceVoucher.findFirst({ where: { id, isDelete: 1 }, include: detailInclude });
  if (!voucher) throw new AppError('Không tìm thấy phiếu chi tạm ứng', 404);
  const totalAmount = voucher.items.reduce((sum, item) => sum + netAmount(item), 0);
  const totalChi = voucher.items.filter((i: any) => i.kind !== 'Giảm trừ').reduce((sum, item) => sum + Number((item as any).amount ?? 0), 0);
  const totalGiam = voucher.items.filter((i: any) => i.kind === 'Giảm trừ').reduce((sum, item) => sum + Number((item as any).amount ?? 0), 0);
  return { ...voucher, totalAmount, totalChi, totalGiam };
}

// Tạo phiếu chi mới, sinh mã advanceNo
export async function createAdvanceVoucher(input: AdvanceVoucherInput, userId: number) {
  await requireAdvanceStaff(input.advanceStaffId);
  const advanceNo = await nextAdvanceNo();
  return prisma.advanceVoucher.create({
    data: { ...input, advanceNo, createdById: userId, approvalStatus: 'draft' },
    include,
  });
}

// Cập nhật phiếu chi (chỉ khi nháp / bị từ chối)
export async function updateAdvanceVoucher(id: number, input: AdvanceVoucherInput) {
  await requireEditableVoucher(id);
  await requireAdvanceStaff(input.advanceStaffId);
  return prisma.advanceVoucher.update({ where: { id }, data: input, include });
}

// Kiểm tra nhân viên ứng tiền tồn tại (nếu có chọn), ném lỗi nếu không
async function requireAdvanceStaff(advanceStaffId?: number | null) {
  if (advanceStaffId == null) return;
  const staff = await prisma.user.findFirst({ where: { id: advanceStaffId, isDelete: 1 }, select: { id: true } });
  if (!staff) throw new AppError('Nhân viên ứng tiền không tồn tại', 400);
}

// Xóa mềm phiếu chi (chỉ khi nháp / bị từ chối)
export async function deleteAdvanceVoucher(id: number) {
  const exists = await requireEditableVoucher(id);
  await prisma.$transaction([
    prisma.advanceVoucher.update({ where: { id }, data: { isDelete: -1 } }),
    prisma.advanceVoucherItem.updateMany({ where: { voucherId: id }, data: { isDelete: -1 } }),
    prisma.jobOrder.updateMany({ where: { sourceAdvanceVoucherId: id, isDelete: 1 }, data: { isDelete: -1 } }),
  ]);
  return { ...exists, isDelete: -1 };
}

// Đồng bộ 1 dòng Job Order tương đương Our Company Pay từ khoản Chi của phiếu Chi tạm ứng
async function syncJobOrderFromItem(voucherId: number, itemId: number) {
  const voucher = await prisma.advanceVoucher.findUnique({ where: { id: voucherId } });
  const item: any = await prisma.advanceVoucherItem.findUnique({ where: { id: itemId } });
  if (!voucher || !item || item.isDelete !== 1) return null;
  if (voucher.type !== 'Chi tạm ứng' || (voucher as any).sheetId == null) return null;
  if (item.kind === 'Giảm trừ') {
    await prisma.jobOrder.updateMany({ where: { sourceAdvanceItemId: itemId, isDelete: 1 }, data: { isDelete: -1 } });
    return null;
  }
  const amount = item.amount as unknown as number;
  const data: any = {
    sheetId: (voucher as any).sheetId,
    type: 'Our Company Pay',
    description: (item as any).description || item.note || `Tạm ứng ${voucher.advanceNo}`,
    portAmt: amount,
    pretaxAmount: amount,
    taxRate: 0,
    note: `Từ phiếu tạm ứng ${voucher.advanceNo} - khoản #${item.id}`,
    sourceAdvanceVoucherId: voucherId,
    sourceAdvanceItemId: itemId,
    isDelete: 1,
  };
  const existing = await prisma.jobOrder.findFirst({ where: { sourceAdvanceItemId: itemId, isDelete: 1 } });
  if (existing) return prisma.jobOrder.update({ where: { id: existing.id }, data });
  return prisma.jobOrder.create({ data });
}

// Thêm khoản chi vào phiếu
export async function createAdvanceItem(voucherId: number, input: AdvanceItemInput) {
  await requireEditableVoucher(voucherId);
  return prisma.advanceVoucherItem.create({ data: { ...scaleAdvanceItem(input), voucherId } });
}

// Cập nhật khoản chi
export async function updateAdvanceItem(voucherId: number, id: number, input: AdvanceItemInput) {
  await requireEditableVoucher(voucherId);
  const item = await prisma.advanceVoucherItem.findFirst({ where: { id, voucherId, isDelete: 1 } });
  if (!item) throw new AppError('Không tìm thấy khoản chi', 404);
  const updated: any = await prisma.advanceVoucherItem.update({ where: { id }, data: scaleAdvanceItem(input) });
  // vẫn đồng bộ nếu đã từng liên kết (sửa tiền/mô tả -> cập nhật job cũ)
  const linked = await prisma.jobOrder.findFirst({ where: { sourceAdvanceItemId: id, isDelete: 1 }, select: { id: true } });
  if (linked) await syncJobOrderFromItem(voucherId, id);
  return updated;
}

// Xóa mềm khoản chi
export async function deleteAdvanceItem(voucherId: number, id: number) {
  await requireEditableVoucher(voucherId);
  const item = await prisma.advanceVoucherItem.findFirst({ where: { id, voucherId, isDelete: 1 } });
  if (!item) throw new AppError('Không tìm thấy khoản chi', 404);
  const res = await prisma.advanceVoucherItem.update({ where: { id }, data: { isDelete: -1 } });
  await prisma.jobOrder.updateMany({ where: { sourceAdvanceItemId: id, isDelete: 1 }, data: { isDelete: -1 } });
  return res;
}

// ===== Luồng duyệt phiếu chi =====

// Trình duyệt: nháp / bị từ chối -> chờ Trưởng bộ phận
export async function submitAdvanceVoucher(id: number, userId: number) {
  const voucher = await prisma.advanceVoucher.findFirst({ where: { id, isDelete: 1 } });
  if (!voucher) throw new AppError('Không tìm thấy phiếu chi tạm ứng', 404);
  if (!EDITABLE_STATUSES.includes(voucher.approvalStatus)) {
    throw new AppError('Chỉ phiếu nháp hoặc bị từ chối mới được trình duyệt', 400);
  }
  const canSubmit = voucher.createdById === userId || (await hasPermission(userId, 'advance_voucher', 'edit'));
  if (!canSubmit) throw new AppError('Bạn không có quyền trình duyệt phiếu này', 403);
  const actor = await getActor(userId);
  const updated = await prisma.advanceVoucher.update({
    where: { id },
    data: {
      approvalStatus: 'pending_dept',
      submittedById: userId,
      submittedByName: actor.fullName,
      submittedAt: new Date(),
      rejectReason: null,
      rejectedById: null,
      rejectedByName: null,
      rejectedAt: null,
    },
    include,
  });
  await writeLog(id, 'submit', voucher.approvalStatus, 'pending_dept', userId, actor.fullName, null);
  return updated;
}

// Trưởng bộ phận duyệt -> chờ Kế toán
export async function approveAdvanceDept(id: number, userId: number, note?: string | null) {
  const voucher = await prisma.advanceVoucher.findFirst({ where: { id, isDelete: 1 } });
  if (!voucher) throw new AppError('Không tìm thấy phiếu chi tạm ứng', 404);
  if (voucher.approvalStatus !== 'pending_dept') {
    throw new AppError('Phiếu không ở bước chờ Trưởng bộ phận duyệt', 400);
  }
  const actor = await getActor(userId);
  const updated = await prisma.advanceVoucher.update({
    where: { id },
    data: {
      approvalStatus: 'pending_accountant',
      deptApprovedById: userId,
      deptApprovedByName: actor.fullName,
      deptApprovedAt: new Date(),
      deptApproveNote: note?.trim() ? note.trim() : null,
    },
    include,
  });
  await writeLog(id, 'approve_dept', voucher.approvalStatus, 'pending_accountant', userId, actor.fullName, note);
  return updated;
}

// Kế toán duyệt -> đã duyệt, chờ chi tiền
export async function approveAdvanceAccountant(id: number, userId: number, note?: string | null) {
  const voucher = await prisma.advanceVoucher.findFirst({ where: { id, isDelete: 1 } });
  if (!voucher) throw new AppError('Không tìm thấy phiếu chi tạm ứng', 404);
  if (voucher.approvalStatus !== 'pending_accountant') {
    throw new AppError('Phiếu không ở bước chờ Kế toán duyệt', 400);
  }
  const actor = await getActor(userId);
  const updated = await prisma.advanceVoucher.update({
    where: { id },
    data: {
      approvalStatus: 'approved',
      accountantApprovedById: userId,
      accountantApprovedByName: actor.fullName,
      accountantApprovedAt: new Date(),
      accountantApproveNote: note?.trim() ? note.trim() : null,
    },
    include,
  });
  await writeLog(id, 'approve_accountant', voucher.approvalStatus, 'approved', userId, actor.fullName, note);
  return updated;
}

// Từ chối ở bước Trưởng bộ phận hoặc Kế toán
export async function rejectAdvanceVoucher(id: number, userId: number, note?: string | null) {
  const voucher = await prisma.advanceVoucher.findFirst({ where: { id, isDelete: 1 } });
  if (!voucher) throw new AppError('Không tìm thấy phiếu chi tạm ứng', 404);
  if (!['pending_dept', 'pending_accountant'].includes(voucher.approvalStatus)) {
    throw new AppError('Chỉ từ chối được phiếu đang chờ duyệt', 400);
  }
  if (!note?.trim()) throw new AppError('Vui lòng nhập lý do từ chối', 400);
  const actor = await getActor(userId);
  const step = voucher.approvalStatus === 'pending_dept' ? 'dept' : 'accountant';
  const updated = await prisma.advanceVoucher.update({
    where: { id },
    data: {
      approvalStatus: 'rejected',
      rejectReason: note.trim(),
      rejectedById: userId,
      rejectedByName: actor.fullName,
      rejectedAt: new Date(),
    },
    include,
  });
  await writeLog(id, `reject_${step}`, voucher.approvalStatus, 'rejected', userId, actor.fullName, note);
  return updated;
}

// Thủ quỹ xác nhận đã chi tiền
export async function payAdvanceVoucher(id: number, userId: number, note?: string | null) {
  const voucher = await prisma.advanceVoucher.findFirst({ where: { id, isDelete: 1 } });
  if (!voucher) throw new AppError('Không tìm thấy phiếu chi tạm ứng', 404);
  if (voucher.approvalStatus !== 'approved') {
    throw new AppError('Phiếu chưa được duyệt hoặc đã chi tiền', 400);
  }
  const actor = await getActor(userId);
  const updated = await prisma.advanceVoucher.update({
    where: { id },
    data: {
      approvalStatus: 'paid',
      paidById: userId,
      paidByName: actor.fullName,
      paidAt: new Date(),
      paidNote: note?.trim() ? note.trim() : null,
    },
    include,
  });
  await writeLog(id, 'pay', voucher.approvalStatus, 'paid', userId, actor.fullName, note);
  return updated;
}

// Người nhận tiền xác nhận đã nhận (hoặc người có quyền duyệt / admin)
export async function receiveAdvanceVoucher(id: number, userId: number, note?: string | null) {
  const voucher = await prisma.advanceVoucher.findFirst({ where: { id, isDelete: 1 } });
  if (!voucher) throw new AppError('Không tìm thấy phiếu chi tạm ứng', 404);
  if (voucher.approvalStatus !== 'paid') {
    throw new AppError('Phiếu chưa được xác nhận chi tiền', 400);
  }
  const canOverride = await hasPermission(userId, 'advance_voucher', 'approve');
  const receiverId = voucher.advanceStaffId ?? voucher.createdById;
  if (receiverId !== userId && !canOverride) {
    throw new AppError('Chỉ người nhận tiền của phiếu mới được xác nhận', 403);
  }
  const actor = await getActor(userId);
  const updated = await prisma.advanceVoucher.update({
    where: { id },
    data: {
      approvalStatus: 'received',
      receivedById: userId,
      receivedByName: actor.fullName,
      receivedAt: new Date(),
      receivedNote: note?.trim() ? note.trim() : null,
    },
    include,
  });
  await writeLog(id, 'receive', voucher.approvalStatus, 'received', userId, actor.fullName, note);
  return updated;
}

// Admin mở khóa phiếu về nháp
export async function resetAdvanceVoucher(id: number, userId: number) {
  const voucher = await prisma.advanceVoucher.findFirst({ where: { id, isDelete: 1 } });
  if (!voucher) throw new AppError('Không tìm thấy phiếu chi tạm ứng', 404);
  const actor = await getActor(userId);
  const updated = await prisma.advanceVoucher.update({
    where: { id },
    data: {
      approvalStatus: 'draft',
      submittedById: null,
      submittedByName: null,
      submittedAt: null,
      deptApprovedById: null,
      deptApprovedByName: null,
      deptApprovedAt: null,
      deptApproveNote: null,
      accountantApprovedById: null,
      accountantApprovedByName: null,
      accountantApprovedAt: null,
      accountantApproveNote: null,
      paidById: null,
      paidByName: null,
      paidAt: null,
      paidNote: null,
      receivedById: null,
      receivedByName: null,
      receivedAt: null,
      receivedNote: null,
      rejectReason: null,
      rejectedById: null,
      rejectedByName: null,
      rejectedAt: null,
    },
    include,
  });
  await writeLog(id, 'admin_reset', voucher.approvalStatus, 'draft', userId, actor.fullName, null);
  return updated;
}