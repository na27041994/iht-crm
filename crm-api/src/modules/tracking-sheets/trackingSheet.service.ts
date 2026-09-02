import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import { toScaled } from '../../lib/money.js';
import type { TrackingSheetInput, JobOrderInput, JobBookingInput, DebitNoteInput } from './trackingSheet.schema.js';

// Scale tiền *100 để lưu nguyên (VD: 100.50 -> 10050), hiển thị chia 100
function scaleJobOrder(input: JobOrderInput): JobOrderInput {
  return { ...input, portAmt: toScaled(input.portAmt) as unknown as number ?? input.portAmt };
}
function scaleJobBooking(input: JobBookingInput): JobBookingInput {
  return {
    ...input,
    pretaxAmount: toScaled(input.pretaxAmount) as unknown as number ?? input.pretaxAmount,
    taxAmount: toScaled(input.taxAmount) as unknown as number ?? input.taxAmount,
    afterTaxAmount: toScaled(input.afterTaxAmount) as unknown as number ?? input.afterTaxAmount,
    total: toScaled(input.total) as unknown as number ?? input.total,
  };
}
function scaleDebitNote(input: DebitNoteInput): DebitNoteInput {
  return {
    ...input,
    priceVnd: toScaled(input.priceVnd) as unknown as number ?? input.priceVnd,
    priceUsd: toScaled(input.priceUsd) as unknown as number ?? input.priceUsd,
    total: toScaled(input.total) as unknown as number ?? input.total,
  };
}

export const trackingSheetInclude = {
  docStaff: { select: { id: true, fullName: true } },
  deliveryStaff: { select: { id: true, fullName: true } },
  createdBy: { select: { id: true, fullName: true } },
  customer: { select: { id: true, customerName: true, companyName: true } },
  carrier: { select: { id: true, carrierName: true, companyName: true } },
  agent: { select: { id: true, agentName: true, companyName: true } },
  jobOrders: {
    where: { isDelete: 1 },
    orderBy: { id: 'asc' },
  },
  jobBookings: {
    where: { isDelete: 1 },
    orderBy: { id: 'asc' },
  },
  debitNotes: { where: { isDelete: 1 }, orderBy: { id: 'asc' } },
} satisfies Prisma.TrackingSheetInclude;

export type TrackingSheetWithRelations = Prisma.TrackingSheetGetPayload<{
  include: typeof trackingSheetInclude;
}>;

// Hàm nextSheetNumber: xử lý nextSheetNumber
async function nextSheetNumber(now = new Date()): Promise<string> {
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const prefix = `J${y}${m}${d}-`;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 86400000);

  // Retry loop to handle concurrent requests
  for (let attempt = 0; attempt < 10; attempt++) {
    const count = await prisma.trackingSheet.count({
      where: { createdAt: { gte: start, lt: end } },
    });
    const candidate = `${prefix}${String(count + 1).padStart(3, '0')}`;

    // Check if candidate already exists
    const existing = await prisma.trackingSheet.findUnique({
      where: { sheetNumber: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    // Small delay before retry
    await new Promise((resolve) => setTimeout(resolve, 10 + Math.random() * 20));
  }

  // Fallback: use timestamp-based suffix
  const timestamp = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}${timestamp}`;
}

// Liệt kê phiếu theo dõi có phân trang và tìm kiếm
export async function listTrackingSheets(search?: string, page = 1, pageSize = 20) {
  const where: Prisma.TrackingSheetWhereInput = { isDelete: 1 };
  if (search) {
    where.OR = [
      { sheetNumber: { contains: search, mode: 'insensitive' } },
      { containerNumber: { contains: search, mode: 'insensitive' } },
      { customer: { is: { companyName: { contains: search, mode: 'insensitive' } } } },
      { fromLocation: { contains: search, mode: 'insensitive' } },
      { toLocation: { contains: search, mode: 'insensitive' } },
      { customNo: { contains: search, mode: 'insensitive' } },
      { billNumber: { contains: search, mode: 'insensitive' } },
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { pol: { contains: search, mode: 'insensitive' } },
      { pod: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.trackingSheet.count({ where }),
    prisma.trackingSheet.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: trackingSheetInclude,
    }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// Lấy chi tiết một phiếu theo dõi
export async function getTrackingSheet(id: number) {
  const sheet = await prisma.trackingSheet.findFirst({ where: { id, isDelete: 1 }, include: trackingSheetInclude });
  if (!sheet) throw new AppError('Không tìm thấy phiếu theo dõi', 404);
  return sheet;
}

// Lấy nhiều phiếu theo dõi theo ids
export async function getTrackingSheetsByIds(ids: number[]) {
  if (!ids.length) return [];
  return prisma.trackingSheet.findMany({
    where: { id: { in: ids }, isDelete: 1 },
    orderBy: { id: 'asc' },
    include: trackingSheetInclude,
  });
}

// Lấy phiếu theo dõi để xuất Excel
export async function getTrackingSheetsForExport(opts: {
  search?: string;
  customerId?: number;
  from?: Date;
  to?: Date;
}) {
  const where: Prisma.TrackingSheetWhereInput = { isDelete: 1 };
  if (opts.customerId) {
    where.customerId = opts.customerId;
  }
  if (opts.from || opts.to) {
    where.createdAt = {};
    if (opts.from) where.createdAt.gte = opts.from;
    if (opts.to) where.createdAt.lte = opts.to;
  }
  if (opts.search) {
    const s = opts.search;
    where.OR = [
      { sheetNumber: { contains: s, mode: 'insensitive' } },
      { containerNumber: { contains: s, mode: 'insensitive' } },
      { customer: { is: { companyName: { contains: s, mode: 'insensitive' } } } },
      { fromLocation: { contains: s, mode: 'insensitive' } },
      { toLocation: { contains: s, mode: 'insensitive' } },
      { customNo: { contains: s, mode: 'insensitive' } },
      { billNumber: { contains: s, mode: 'insensitive' } },
      { invoiceNumber: { contains: s, mode: 'insensitive' } },
      { pol: { contains: s, mode: 'insensitive' } },
      { pod: { contains: s, mode: 'insensitive' } },
    ];
  }
  return prisma.trackingSheet.findMany({
    where,
    orderBy: { id: 'asc' },
    include: trackingSheetInclude,
  });
}

// Tạo phiếu theo dõi mới, sinh mã sheetNumber (chống duplicate khi bấm liên tục)
export async function createTrackingSheet(input: TrackingSheetInput, createdById?: number) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const sheetNumber = await nextSheetNumber();
    try {
      return await prisma.trackingSheet.create({
        data: { ...input, sheetNumber, createdById },
        include: trackingSheetInclude,
      });
    } catch (e: any) {
      // P2002 unique violation trên sheetNumber do race khi bấm liên tục
      if (e?.code === 'P2002' && String(e?.meta?.target ?? '').includes('sheetNumber')) {
        await new Promise((r) => setTimeout(r, 20 + Math.random() * 30));
        continue;
      }
      throw e;
    }
  }
  throw new AppError('Không tạo được phiếu, vui lòng thử lại', 409);
}

// Cập nhật phiếu theo dõi
export async function updateTrackingSheet(id: number, input: TrackingSheetInput) {
  const exists = await prisma.trackingSheet.findFirst({ where: { id, isDelete: 1 } });
  if (!exists) throw new AppError('Không tìm thấy phiếu theo dõi', 404);
  return prisma.trackingSheet.update({ where: { id }, data: input, include: trackingSheetInclude });
}

// Xóa mềm phiếu theo dõi
export async function deleteTrackingSheet(id: number) {
  const exists = await prisma.trackingSheet.findFirst({ where: { id, isDelete: 1 } });
  if (!exists) throw new AppError('Không tìm thấy phiếu theo dõi', 404);
  await prisma.$transaction([
    prisma.trackingSheet.update({ where: { id }, data: { isDelete: -1 } }),
    prisma.jobOrder.updateMany({ where: { sheetId: id }, data: { isDelete: -1 } }),
    prisma.jobBooking.updateMany({ where: { sheetId: id }, data: { isDelete: -1 } }),
    prisma.debitNote.updateMany({ where: { sheetId: id }, data: { isDelete: -1 } }),
  ]);
  return { ...exists, isDelete: -1 };
}

// Hàm requireSheet: xử lý requireSheet
async function requireSheet(sheetId: number) {
  const sheet = await prisma.trackingSheet.findFirst({ where: { id: sheetId, isDelete: 1 } });
  if (!sheet) throw new AppError('Không tìm thấy phiếu theo dõi', 404);
  return sheet;
}

// Tạo Job Order/Booking/DebitNote cho phiếu
export async function createJobOrder(sheetId: number, input: JobOrderInput) {
  await requireSheet(sheetId);
  return prisma.jobOrder.create({ data: { ...scaleJobOrder(input), sheetId } });
}

// Cập nhật Job item
export async function updateJobOrder(sheetId: number, id: number, input: JobOrderInput) {
  const item = await prisma.jobOrder.findFirst({ where: { id, sheetId, isDelete: 1 } });
  if (!item) throw new AppError('Không tìm thấy mục Job Order', 404);
  return prisma.jobOrder.update({ where: { id }, data: scaleJobOrder(input) });
}

// Xóa mềm Job item
export async function deleteJobOrder(sheetId: number, id: number) {
  const item = await prisma.jobOrder.findFirst({ where: { id, sheetId, isDelete: 1 } });
  if (!item) throw new AppError('Không tìm thấy mục Job Order', 404);
  return prisma.jobOrder.update({ where: { id }, data: { isDelete: -1 } });
}

// Tạo Job Order/Booking/DebitNote cho phiếu
export async function createJobBooking(sheetId: number, input: JobBookingInput) {
  await requireSheet(sheetId);
  return prisma.jobBooking.create({ data: { ...scaleJobBooking(input), sheetId } });
}

// Cập nhật Job item
export async function updateJobBooking(sheetId: number, id: number, input: JobBookingInput) {
  const item = await prisma.jobBooking.findFirst({ where: { id, sheetId, isDelete: 1 } });
  if (!item) throw new AppError('Không tìm thấy mục Job Book', 404);
  return prisma.jobBooking.update({ where: { id }, data: scaleJobBooking(input) });
}

// Xóa mềm Job item
export async function deleteJobBooking(sheetId: number, id: number) {
  const item = await prisma.jobBooking.findFirst({ where: { id, sheetId, isDelete: 1 } });
  if (!item) throw new AppError('Không tìm thấy mục Job Book', 404);
  return prisma.jobBooking.update({ where: { id }, data: { isDelete: -1 } });
}

// Tạo Job Order/Booking/DebitNote cho phiếu
export async function createDebitNote(sheetId: number, input: DebitNoteInput) {
  await requireSheet(sheetId);
  return prisma.debitNote.create({ data: { ...scaleDebitNote(input), sheetId } });
}

// Cập nhật Job item
export async function updateDebitNote(sheetId: number, id: number, input: DebitNoteInput) {
  const item = await prisma.debitNote.findFirst({ where: { id, sheetId, isDelete: 1 } });
  if (!item) throw new AppError('Không tìm thấy mục Debit Note', 404);
  return prisma.debitNote.update({ where: { id }, data: scaleDebitNote(input) });
}

// Xóa mềm Job item
export async function deleteDebitNote(sheetId: number, id: number) {
  const item = await prisma.debitNote.findFirst({ where: { id, sheetId, isDelete: 1 } });
  if (!item) throw new AppError('Không tìm thấy mục Debit Note', 404);
  return prisma.debitNote.update({ where: { id }, data: { isDelete: -1 } });
}