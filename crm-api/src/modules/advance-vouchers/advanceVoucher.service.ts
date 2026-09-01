import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import { toScaled } from '../../lib/money.js';
import type { AdvanceVoucherInput, AdvanceItemInput } from './advanceVoucher.schema.js';

function scaleAdvanceItem(input: AdvanceItemInput): AdvanceItemInput {
  return { ...input, amount: toScaled(input.amount as unknown as number) as unknown as number ?? input.amount };
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
    totalAmount: row.items.reduce((sum, item) => sum + Number(item.amount), 0),
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
    totalAmount: row.items.reduce((sum, item) => sum + Number(item.amount), 0),
  }));
}

// Lấy chi tiết một phiếu chi và tính tổng tiền
export async function getAdvanceVoucher(id: number) {
  const voucher = await prisma.advanceVoucher.findFirst({ where: { id, isDelete: 1 }, include });
  if (!voucher) throw new AppError('Không tìm thấy phiếu chi tạm ứng', 404);
  const totalAmount = voucher.items.reduce((sum, item) => sum + Number(item.amount), 0);
  return { ...voucher, totalAmount };
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
  ]);
  return { ...exists, isDelete: -1 };
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
  return prisma.advanceVoucherItem.update({ where: { id }, data: scaleAdvanceItem(input) });
}

// Xóa mềm khoản chi
export async function deleteAdvanceItem(voucherId: number, id: number) {
  const item = await prisma.advanceVoucherItem.findFirst({ where: { id, voucherId, isDelete: 1 } });
  if (!item) throw new AppError('Không tìm thấy khoản chi', 404);
  return prisma.advanceVoucherItem.update({ where: { id }, data: { isDelete: -1 } });
}

// Kiểm tra phiếu chi tồn tại, ném lỗi nếu không
async function requireVoucher(voucherId: number) {
  const exists = await prisma.advanceVoucher.findFirst({ where: { id: voucherId, isDelete: 1 } });
  if (!exists) throw new AppError('Không tìm thấy phiếu chi tạm ứng', 404);
}