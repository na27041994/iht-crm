import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import { toScaled } from '../../lib/money.js';
import type { ReceiptVoucherInput } from './receiptVoucher.schema.js';

// Tien hien thi -> scale x100 truoc khi luu (chuan money)
function scaleReceipt(input: ReceiptVoucherInput): ReceiptVoucherInput {
  return {
    ...input,
    amount: (toScaled(input.amount as unknown as number) as unknown as number) ?? input.amount,
    transFee: input.transFee == null ? 0 : ((toScaled(input.transFee as unknown as number) as unknown as number) ?? input.transFee),
  };
}

const include = {
  customer: { select: { id: true, customerName: true, companyName: true, address: true } },
  createdBy: { select: { id: true, fullName: true } },
  staff: { select: { id: true, fullName: true } },
} satisfies Prisma.ReceiptVoucherInclude;

// Sinh mã phiếu thu mới: T + YYMMDD + seq 3 số
async function nextReceiptNo(now = new Date()) {
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 86400000);
  const count = await prisma.receiptVoucher.count({
    where: { createdAt: { gte: start, lt: end } },
  });
  return `T${y}${m}${d}${String(count + 1).padStart(3, '0')}`;
}

// Tên người nộp để tìm kiếm/hiển thị: Cá nhân -> payerName, Khách Hàng -> tên công ty
function payerDisplay(v: { payerType: string; payerName?: string | null; customer?: { companyName?: string; customerName?: string } | null }) {
  if (v.payerType === 'Cá nhân') return v.payerName ?? '';
  return v.customer ? v.customer.companyName || v.customer.customerName : '';
}

// Liệt kê phiếu thu có lọc theo loại đối tượng/khách/ngày
export async function listReceiptVouchers(opts: {
  search?: string;
  payerType?: string;
  customerId?: number;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}) {
  const { search, payerType, customerId, from, to, page = 1, pageSize = 20 } = opts;
  const where: Prisma.ReceiptVoucherWhereInput = { isDelete: 1 };
  if (search) {
    where.OR = [
      { receiptNo: { contains: search, mode: 'insensitive' } },
      { payerName: { contains: search, mode: 'insensitive' } },
      { note: { contains: search, mode: 'insensitive' } },
      { customer: { is: { companyName: { contains: search, mode: 'insensitive' } } } },
    ];
  }
  if (payerType) where.payerType = payerType;
  if (customerId) where.customerId = customerId;
  if (from || to) {
    where.receiptDate = {};
    if (from) where.receiptDate.gte = from;
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      where.receiptDate.lte = end;
    }
  }

  const [total, rows] = await Promise.all([
    prisma.receiptVoucher.count({ where }),
    prisma.receiptVoucher.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include,
    }),
  ]);

  const items = rows.map((row) => ({ ...row, payerDisplay: payerDisplay(row) }));
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// Lấy nhiều phiếu thu theo ids để in/batch
export async function getReceiptVouchersByIds(ids: number[]) {
  if (!ids.length) return [];
  const rows = await prisma.receiptVoucher.findMany({
    where: { id: { in: ids }, isDelete: 1 },
    include,
    orderBy: { id: 'asc' },
  });
  return rows.map((row) => ({ ...row, payerDisplay: payerDisplay(row) }));
}

// Lấy phiếu thu để xuất Excel
export async function getReceiptVouchersForExport(opts: {
  search?: string;
  payerType?: string;
  customerId?: number;
  from?: Date;
  to?: Date;
  ids?: number[];
}) {
  const where: Prisma.ReceiptVoucherWhereInput = { isDelete: 1 };
  if (opts.ids?.length) {
    where.id = { in: opts.ids };
  } else {
    if (opts.search) {
      where.OR = [
        { receiptNo: { contains: opts.search, mode: 'insensitive' } },
        { payerName: { contains: opts.search, mode: 'insensitive' } },
        { note: { contains: opts.search, mode: 'insensitive' } },
        { customer: { is: { companyName: { contains: opts.search, mode: 'insensitive' } } } },
      ];
    }
    if (opts.payerType) where.payerType = opts.payerType;
    if (opts.customerId) where.customerId = opts.customerId;
    if (opts.from || opts.to) {
      where.receiptDate = {};
      if (opts.from) where.receiptDate.gte = opts.from;
      if (opts.to) {
        const end = new Date(opts.to);
        end.setHours(23, 59, 59, 999);
        where.receiptDate.lte = end;
      }
    }
  }
  const rows = await prisma.receiptVoucher.findMany({ where, orderBy: { id: 'asc' }, include });
  return rows.map((row) => ({ ...row, payerDisplay: payerDisplay(row) }));
}

// Lấy chi tiết một phiếu thu
export async function getReceiptVoucher(id: number) {
  const voucher = await prisma.receiptVoucher.findFirst({ where: { id, isDelete: 1 }, include });
  if (!voucher) throw new AppError('Không tìm thấy phiếu thu', 404);
  return { ...voucher, payerDisplay: payerDisplay(voucher) };
}

// Tạo phiếu thu mới, sinh mã receiptNo
export async function createReceiptVoucher(input: ReceiptVoucherInput, userId: number) {
  await requireStaff(input.staffId);
  const receiptNo = await nextReceiptNo();
  return prisma.receiptVoucher.create({
    data: { ...scaleReceipt(input), receiptNo, createdById: userId },
    include,
  });
}

// Cập nhật phiếu thu
export async function updateReceiptVoucher(id: number, input: ReceiptVoucherInput) {
  const exists = await prisma.receiptVoucher.findFirst({ where: { id, isDelete: 1 } });
  if (!exists) throw new AppError('Không tìm thấy phiếu thu', 404);
  await requireStaff(input.staffId);
  return prisma.receiptVoucher.update({ where: { id }, data: scaleReceipt(input), include });
}

// Kiểm tra nhân viên thu tồn tại (nếu có chọn), ném lỗi nếu không
async function requireStaff(staffId?: number | null) {
  if (staffId == null) return;
  const staff = await prisma.user.findFirst({ where: { id: staffId, isDelete: 1 }, select: { id: true } });
  if (!staff) throw new AppError('Nhân viên thu không tồn tại', 400);
}

// Xóa mềm phiếu thu
export async function deleteReceiptVoucher(id: number) {
  const exists = await prisma.receiptVoucher.findFirst({ where: { id, isDelete: 1 } });
  if (!exists) throw new AppError('Không tìm thấy phiếu thu', 404);
  await prisma.receiptVoucher.update({ where: { id }, data: { isDelete: -1 } });
  return { ...exists, isDelete: -1 };
}
