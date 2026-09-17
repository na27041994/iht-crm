import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import { toScaled } from '../../lib/money.js';
import type { AdvanceVoucherInput, AdvanceItemInput } from './advanceVoucher.schema.js';

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
  items: { where: { isDelete: 1 }, orderBy: { id: 'asc' } },
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
  page?: number;
  pageSize?: number;
}) {
  const { search, type, customerId, from, to, page = 1, pageSize = 20 } = opts;
  const where: Prisma.AdvanceVoucherWhereInput = { isDelete: 1 };
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
  const voucher = await prisma.advanceVoucher.findFirst({ where: { id, isDelete: 1 }, include });
  if (!voucher) throw new AppError('Không tìm thấy phiếu chi tạm ứng', 404);
  const totalAmount = voucher.items.reduce((sum, item) => sum + netAmount(item), 0);
  const totalChi = voucher.items.filter((i: any) => i.kind !== 'Giảm trừ').reduce((sum, item) => sum + Number((item as any).amount ?? 0), 0);
  const totalGiam = voucher.items.filter((i: any) => i.kind === 'Giảm trừ').reduce((sum, item) => sum + Number((item as any).amount ?? 0), 0);
  return { ...voucher, totalAmount, totalChi, totalGiam };
}

// Tạo phiếu chi mới, sinh mã advanceNo
export async function createAdvanceVoucher(input: AdvanceVoucherInput, userId: number) {
  const advanceNo = await nextAdvanceNo();
  return prisma.advanceVoucher.create({
    data: { ...input, advanceNo, createdById: userId },
    include,
  });
}

// Cập nhật phiếu chi
export async function updateAdvanceVoucher(id: number, input: AdvanceVoucherInput) {
  const exists = await prisma.advanceVoucher.findFirst({ where: { id, isDelete: 1 } });
  if (!exists) throw new AppError('Không tìm thấy phiếu chi tạm ứng', 404);
  return prisma.advanceVoucher.update({ where: { id }, data: input, include });
}

// Xóa mềm phiếu chi
export async function deleteAdvanceVoucher(id: number) {
  const exists = await prisma.advanceVoucher.findFirst({ where: { id, isDelete: 1 } });
  if (!exists) throw new AppError('Không tìm thấy phiếu chi tạm ứng', 404);
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
  await requireVoucher(voucherId);
  return prisma.advanceVoucherItem.create({ data: { ...scaleAdvanceItem(input), voucherId } });
}

// Cập nhật khoản chi
export async function updateAdvanceItem(voucherId: number, id: number, input: AdvanceItemInput) {
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
  const item = await prisma.advanceVoucherItem.findFirst({ where: { id, voucherId, isDelete: 1 } });
  if (!item) throw new AppError('Không tìm thấy khoản chi', 404);
  const res = await prisma.advanceVoucherItem.update({ where: { id }, data: { isDelete: -1 } });
  await prisma.jobOrder.updateMany({ where: { sourceAdvanceItemId: id, isDelete: 1 }, data: { isDelete: -1 } });
  return res;
}

// Kiểm tra phiếu chi tồn tại, ném lỗi nếu không
async function requireVoucher(voucherId: number) {
  const exists = await prisma.advanceVoucher.findFirst({ where: { id: voucherId, isDelete: 1 } });
  if (!exists) throw new AppError('Không tìm thấy phiếu chi tạm ứng', 404);
}