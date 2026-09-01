import ExcelJS from 'exceljs';
import { prisma } from '../../lib/prisma.js';
import { toScaled } from '../../lib/money.js';

interface ImportSheetRow {
  containerNumber?: string | null;
  customerId?: number | null;
  fromLocation?: string | null;
  toLocation?: string | null;
  containerQuantity?: number | null;
  etaDate?: Date | string | null;
  nw?: number | null;
  gw?: number | null;
  customNo?: string | null;
  declarationDate?: Date | string | null;
  billNumber?: string | null;
  invoiceNumber?: string | null;
  pol?: string | null;
  pod?: string | null;
  note?: string | null;
  docStaffId?: number | null;
  deliveryStaffId?: number | null;
  createdById?: number | null;
}

interface ImportOrderRow {
  sheetId: number | string;
  type: string;
  description?: string | null;
  portAmt?: number | null;
  industry?: string | null;
  note?: string | null;
}

interface ImportBookingRow {
  sheetId: number | string;
  type: string;
  description?: string | null;
  unit?: string | null;
  quantity?: number | null;
  pretaxAmount?: number | null;
  taxRate?: number | null;
  note?: string | null;
}

interface ImportDebitRow {
  sheetId: number | string;
  type: string;
  invoiceNumber?: string | null;
  description?: string | null;
  unit?: string | null;
  currency?: string | null;
  quantity?: number | null;
  priceVnd?: number | null;
  taxRate?: number | null;
  priceUsd?: number | null;
  exchangeRate?: number | null;
}

interface ParsedImportData {
  sheets: ImportSheetRow[];
  orders: ImportOrderRow[];
  bookings: ImportBookingRow[];
  debits: ImportDebitRow[];
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  created: number;
  updated: number;
  errors: string[];
  validationErrors: ValidationError[];
}

// Hàm toNumber: xử lý toNumber
function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// Hàm toDate: xử lý toDate
function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Hàm toInt: xử lý toInt
function toInt(v: unknown): number | null {
  const n = toNumber(v);
  return n == null ? null : Math.trunc(n);
}

// Column mappings (1-based index matching template column order)
const SHEET_COLS: Record<string, number> = {
  containerNumber: 1, customerId: 2, fromLocation: 3, toLocation: 4,
  containerQuantity: 5, etaDate: 6, nw: 7, gw: 8, customNo: 9,
  declarationDate: 10, billNumber: 11, invoiceNumber: 12, pol: 13,
  pod: 14, note: 15, docStaffId: 16, deliveryStaffId: 17, createdById: 18,
};

const ORDER_COLS: Record<string, number> = {
  sheetId: 1, type: 2, description: 3, portAmt: 4, industry: 5,
  note: 6,
};

const BOOKING_COLS: Record<string, number> = {
  sheetId: 1, type: 2, description: 3, unit: 4, quantity: 5,
  pretaxAmount: 6, taxRate: 7, note: 8,
};

const DEBIT_COLS: Record<string, number> = {
  sheetId: 1, type: 2, invoiceNumber: 3, description: 4, unit: 5,
  currency: 6, quantity: 7, priceVnd: 8, taxRate: 9, priceUsd: 10, exchangeRate: 11,
};

// Hàm getCellValue: xử lý getCellValue
function getCellValue(row: ExcelJS.Row, cols: Record<string, number>, key: string): unknown {
  const idx = cols[key];
  if (!idx) return null;
  const cell = row.getCell(idx);
  return cell?.value ?? null;
}

// Validation functions
// Kiểm tra dữ liệu dòng phiếu theo dõi (containerNumber và customerId không còn bắt buộc)
async function validateSheetRow(row: ImportSheetRow, rowNum: number): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  if (row.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: row.customerId, isDelete: 1 } });
    if (!customer) {
      errors.push({ row: rowNum, field: 'customerId', message: `Khách hàng ID ${row.customerId} không tồn tại` });
    }
  }

  if (row.docStaffId) {
    const user = await prisma.user.findUnique({ where: { id: row.docStaffId, isActive: true } });
    if (!user) errors.push({ row: rowNum, field: 'docStaffId', message: `Nhân viên chứng từ ID ${row.docStaffId} không tồn tại` });
  }

  if (row.deliveryStaffId) {
    const user = await prisma.user.findUnique({ where: { id: row.deliveryStaffId, isActive: true } });
    if (!user) errors.push({ row: rowNum, field: 'deliveryStaffId', message: `Nhân viên giao nhận ID ${row.deliveryStaffId} không tồn tại` });
  }

  if (row.createdById) {
    const user = await prisma.user.findUnique({ where: { id: row.createdById, isActive: true } });
    if (!user) errors.push({ row: rowNum, field: 'createdById', message: `Người tạo ID ${row.createdById} không tồn tại` });
  }

  if (row.etaDate && !(row.etaDate instanceof Date) && isNaN(new Date(row.etaDate).getTime())) {
    errors.push({ row: rowNum, field: 'etaDate', message: 'Ngày ETA định dạng không hợp lệ (YYYY-MM-DD)' });
  }

  if (row.declarationDate && !(row.declarationDate instanceof Date) && isNaN(new Date(row.declarationDate).getTime())) {
    errors.push({ row: rowNum, field: 'declarationDate', message: 'Ngày tờ khai định dạng không hợp lệ (YYYY-MM-DD)' });
  }

  return errors;
}

// Middleware validate: kiểm tra schema zod cho body/query
async function validateOrderRow(row: ImportOrderRow, rowNum: number): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  if (!row.type?.trim()) {
    errors.push({ row: rowNum, field: 'type', message: 'Loại không được để trống' });
  }

  return errors;
}

// Middleware validate: kiểm tra schema zod cho body/query
async function validateBookingRow(row: ImportBookingRow, rowNum: number): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  if (!row.type?.trim()) {
    errors.push({ row: rowNum, field: 'type', message: 'Loại không được để trống' });
  }

  return errors;
}

// Middleware validate: kiểm tra schema zod cho body/query
async function validateDebitRow(row: ImportDebitRow, rowNum: number): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  if (!row.type?.trim()) {
    errors.push({ row: rowNum, field: 'type', message: 'Loại không được để trống' });
  }

  if (row.currency && !['VND', 'USD'].includes(row.currency)) {
    errors.push({ row: rowNum, field: 'currency', message: 'Loại tiền tệ chỉ chấp nhận VND hoặc USD' });
  }

  return errors;
}

// Phân tích file Excel import thành các dòng
export async function parseImportExcel(buffer: Buffer): Promise<ParsedImportData> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);

  const sheets: ImportSheetRow[] = [];
  const orders: ImportOrderRow[] = [];
  const bookings: ImportBookingRow[] = [];
  const debits: ImportDebitRow[] = [];

  const wsSheet = wb.getWorksheet('Phieu theo doi');
  if (wsSheet) {
    wsSheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum === 1) return; // header
      const containerNumberRaw = String(getCellValue(row, SHEET_COLS, 'containerNumber') ?? '').trim();
      const customerId = toInt(getCellValue(row, SHEET_COLS, 'customerId'));
      // containerNumber và customerId không bắt buộc nữa — bỏ qua dòng hoàn toàn trống
      const hasAny = containerNumberRaw || customerId || String(getCellValue(row, SHEET_COLS, 'fromLocation') ?? '').trim() || String(getCellValue(row, SHEET_COLS, 'toLocation') ?? '').trim() || String(getCellValue(row, SHEET_COLS, 'note') ?? '').trim();
      if (!hasAny) return;
      sheets.push({
        containerNumber: containerNumberRaw || null,
        customerId: customerId ?? null,
        fromLocation: String(getCellValue(row, SHEET_COLS, 'fromLocation') ?? '').trim() || null,
        toLocation: String(getCellValue(row, SHEET_COLS, 'toLocation') ?? '').trim() || null,
        containerQuantity: toInt(getCellValue(row, SHEET_COLS, 'containerQuantity')),
        etaDate: toDate(getCellValue(row, SHEET_COLS, 'etaDate')),
        nw: toNumber(getCellValue(row, SHEET_COLS, 'nw')),
        gw: toNumber(getCellValue(row, SHEET_COLS, 'gw')),
        customNo: String(getCellValue(row, SHEET_COLS, 'customNo') ?? '').trim() || null,
        declarationDate: toDate(getCellValue(row, SHEET_COLS, 'declarationDate')),
        billNumber: String(getCellValue(row, SHEET_COLS, 'billNumber') ?? '').trim() || null,
        invoiceNumber: String(getCellValue(row, SHEET_COLS, 'invoiceNumber') ?? '').trim() || null,
        pol: String(getCellValue(row, SHEET_COLS, 'pol') ?? '').trim() || null,
        pod: String(getCellValue(row, SHEET_COLS, 'pod') ?? '').trim() || null,
        note: String(getCellValue(row, SHEET_COLS, 'note') ?? '').trim() || null,
        docStaffId: toInt(getCellValue(row, SHEET_COLS, 'docStaffId')),
        deliveryStaffId: toInt(getCellValue(row, SHEET_COLS, 'deliveryStaffId')),
        createdById: toInt(getCellValue(row, SHEET_COLS, 'createdById')),
      });
    });
  }

  const wsOrder = wb.getWorksheet('Job Order');
  if (wsOrder) {
    wsOrder.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum === 1) return;
      const type = String(getCellValue(row, ORDER_COLS, 'type') ?? '').trim();
      const sheetId = getCellValue(row, ORDER_COLS, 'sheetId');
      if (!type || sheetId == null) return;
      orders.push({
        sheetId: String(sheetId).trim(),
        type,
        description: String(getCellValue(row, ORDER_COLS, 'description') ?? '').trim() || null,
        portAmt: toNumber(getCellValue(row, ORDER_COLS, 'portAmt')),
        industry: String(getCellValue(row, ORDER_COLS, 'industry') ?? '').trim() || null,
        note: String(getCellValue(row, ORDER_COLS, 'note') ?? '').trim() || null,
      });
    });
  }

  const wsBooking = wb.getWorksheet('Job Booking');
  if (wsBooking) {
    wsBooking.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum === 1) return;
      const type = String(getCellValue(row, BOOKING_COLS, 'type') ?? '').trim();
      const sheetId = getCellValue(row, BOOKING_COLS, 'sheetId');
      if (!type || sheetId == null) return;
      bookings.push({
        sheetId: String(sheetId).trim(),
        type,
        description: String(getCellValue(row, BOOKING_COLS, 'description') ?? '').trim() || null,
        unit: String(getCellValue(row, BOOKING_COLS, 'unit') ?? '').trim() || null,
        quantity: toNumber(getCellValue(row, BOOKING_COLS, 'quantity')),
        pretaxAmount: toNumber(getCellValue(row, BOOKING_COLS, 'pretaxAmount')),
        taxRate: toNumber(getCellValue(row, BOOKING_COLS, 'taxRate')),
        note: String(getCellValue(row, BOOKING_COLS, 'note') ?? '').trim() || null,
      });
    });
  }

  const wsDebit = wb.getWorksheet('Debit Note');
  if (wsDebit) {
    wsDebit.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum === 1) return;
      const type = String(getCellValue(row, DEBIT_COLS, 'type') ?? '').trim();
      const sheetId = getCellValue(row, DEBIT_COLS, 'sheetId');
      if (!type || sheetId == null) return;
      debits.push({
        sheetId: String(sheetId).trim(),
        type,
        invoiceNumber: String(getCellValue(row, DEBIT_COLS, 'invoiceNumber') ?? '').trim() || null,
        description: String(getCellValue(row, DEBIT_COLS, 'description') ?? '').trim() || null,
        unit: String(getCellValue(row, DEBIT_COLS, 'unit') ?? '').trim() || null,
        currency: String(getCellValue(row, DEBIT_COLS, 'currency') ?? '').trim() || null,
        quantity: toNumber(getCellValue(row, DEBIT_COLS, 'quantity')),
        priceVnd: toNumber(getCellValue(row, DEBIT_COLS, 'priceVnd')),
        taxRate: toNumber(getCellValue(row, DEBIT_COLS, 'taxRate')),
        priceUsd: toNumber(getCellValue(row, DEBIT_COLS, 'priceUsd')),
        exchangeRate: toNumber(getCellValue(row, DEBIT_COLS, 'exchangeRate')),
      });
    });
  }

  return { sheets, orders, bookings, debits };
}

// Hàm resolveSheetId: xử lý resolveSheetId
async function resolveSheetId(
  raw: string,
  createdSheets: Map<number, number>
): Promise<number | null> {
  const n = Number(raw);
  if (!isNaN(n)) {
    if (raw.includes('.') || raw.startsWith('0')) return null;
    if (n > 0 && n <= 100000) {
      const realId = createdSheets.get(n);
      if (realId) return realId;
    }
  }
  return null;
}

// Hàm nextSheetNumber: xử lý nextSheetNumber
async function nextSheetNumber(): Promise<string> {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 86400000);
  const count = await prisma.trackingSheet.count({
    where: { createdAt: { gte: start, lt: end } },
  });
  return `J${y}${m}${d}-${String(count + 1).padStart(3, '0')}`;
}

// Hàm upsertTrackingSheet: xử lý upsertTrackingSheet
async function upsertTrackingSheet(
  row: ImportSheetRow,
  tempIndex: number,
  defaultCreatedById: number
): Promise<{ id: number; action: 'created' | 'updated' } | null> {
  // Check existing chỉ khi có containerNumber hoặc customerId
  let existing = null as any;
  if (row.containerNumber || row.customerId) {
    const where: any = { isDelete: 1 };
    if (row.containerNumber) where.containerNumber = row.containerNumber;
    if (row.customerId) where.customerId = row.customerId;
    // chỉ tìm khi có ít nhất 1 điều kiện, tránh match hàng loạt null
    if (Object.keys(where).length > 1) {
      existing = await prisma.trackingSheet.findFirst({ where });
    }
  }

  const sheetNumber = await nextSheetNumber();
  const data = {
    sheetNumber,
    containerNumber: row.containerNumber,
    customerId: row.customerId,
    fromLocation: row.fromLocation,
    toLocation: row.toLocation,
    containerQuantity: row.containerQuantity ?? 1,
    etaDate: row.etaDate,
    nw: row.nw,
    gw: row.gw,
    customNo: row.customNo,
    declarationDate: row.declarationDate,
    billNumber: row.billNumber,
    invoiceNumber: row.invoiceNumber,
    pol: row.pol,
    pod: row.pod,
    note: row.note,
    docStaffId: row.docStaffId,
    deliveryStaffId: row.deliveryStaffId,
    createdById: row.createdById ?? defaultCreatedById,
    isDelete: 1,
  };

  if (existing) {
    const updated = await prisma.trackingSheet.update({
      where: { id: existing.id },
      data,
    });
    return { id: updated.id, action: 'updated' };
  } else {
    const created = await prisma.trackingSheet.create({ data });
    return { id: created.id, action: 'created' };
  }
}

// Hàm upsertJobOrder: xử lý upsertJobOrder
async function upsertJobOrder(
  row: ImportOrderRow,
  realSheetId: number
): Promise<'created' | 'updated'> {
  // Check if order with same sheetId + type + description exists
  const existing = await prisma.jobOrder.findFirst({
    where: {
      sheetId: realSheetId,
      type: row.type,
      description: row.description,
      isDelete: 1,
    },
  });

  const data = {
    sheetId: realSheetId,
    type: row.type,
    description: row.description,
    portAmt: row.portAmt != null ? toScaled(row.portAmt) as unknown as number : 0,
    industry: row.industry,
    note: row.note,
    isDelete: 1,
  };

  if (existing) {
    await prisma.jobOrder.update({
      where: { id: existing.id },
      data,
    });
    return 'updated';
  } else {
    await prisma.jobOrder.create({ data });
    return 'created';
  }
}

// Hàm upsertJobBooking: xử lý upsertJobBooking
async function upsertJobBooking(
  row: ImportBookingRow,
  realSheetId: number
): Promise<'created' | 'updated'> {
  const existing = await prisma.jobBooking.findFirst({
    where: {
      sheetId: realSheetId,
      type: row.type,
      description: row.description,
      isDelete: 1,
    },
  });

  const pretax = row.pretaxAmount ?? 0;
  const rate = row.taxRate ?? 0;
  const taxAmt = Math.round(pretax * rate / 100 * 100) / 100;
  const afterTax = Math.round(pretax * (1 + rate / 100) * 100) / 100;
  const total = Math.round(afterTax * (row.quantity ?? 1) * 100) / 100;

  const data = {
    sheetId: realSheetId,
    type: row.type,
    description: row.description,
    unit: row.unit,
    quantity: row.quantity ?? 1,
    pretaxAmount: toScaled(pretax) as unknown as number,
    taxRate: rate,
    taxAmount: toScaled(taxAmt) as unknown as number,
    afterTaxAmount: toScaled(afterTax) as unknown as number,
    total: toScaled(total) as unknown as number,
    isDelete: 1,
  };

  if (existing) {
    await prisma.jobBooking.update({
      where: { id: existing.id },
      data,
    });
    return 'updated';
  } else {
    await prisma.jobBooking.create({ data });
    return 'created';
  }
}

// Hàm upsertDebitNote: xử lý upsertDebitNote
async function upsertDebitNote(
  row: ImportDebitRow,
  realSheetId: number
): Promise<'created' | 'updated'> {
  const existing = await prisma.debitNote.findFirst({
    where: {
      sheetId: realSheetId,
      type: row.type,
      invoiceNumber: row.invoiceNumber,
      isDelete: 1,
    },
  });

  const qty = row.quantity ?? 1;
  const priceVnd = row.priceVnd ?? 0;
  const priceUsd = row.priceUsd ?? 0;
  const currency = row.currency ?? 'VND';
  const totalRaw = currency === 'USD'
    ? Math.round(row.priceUsd! * qty * 100) / 100
    : Math.round(row.priceVnd! * qty * 100) / 100;

  const data = {
    sheetId: realSheetId,
    type: row.type,
    invoiceNumber: row.invoiceNumber,
    description: row.description,
    unit: row.unit,
    currency,
    quantity: qty,
    priceVnd: currency === 'VND' ? toScaled(row.priceVnd) as unknown as number : null,
    taxRate: row.taxRate ?? 0,
    priceUsd: currency === 'USD' ? toScaled(row.priceUsd) as unknown as number : null,
    exchangeRate: row.exchangeRate,
    total: toScaled(totalRaw) as unknown as number,
    isDelete: 1,
  };

  if (existing) {
    await prisma.debitNote.update({
      where: { id: existing.id },
      data,
    });
    return 'updated';
  } else {
    await prisma.debitNote.create({ data });
    return 'created';
  }
}

// Tạo phiếu theo dõi mới, sinh mã sheetNumber
export async function createTrackingSheetsFromImport(
  data: ParsedImportData,
  defaultCreatedById: number,
  importLogId: number
): Promise<ImportResult> {
  const errors: string[] = [];
  const validationErrors: ValidationError[] = [];
  let created = 0;
  let updated = 0;
  const createdSheets = new Map<number, number>(); // temp index -> real sheetId

  // 1. Validate all sheets first
  for (let i = 0; i < data.sheets.length; i++) {
    const rowErrors = await validateSheetRow(data.sheets[i], i + 1);
    validationErrors.push(...rowErrors);
  }

  // Validate child rows
  for (let i = 0; i < data.orders.length; i++) {
    const rowErrors = await validateOrderRow(data.orders[i], i + 1);
    validationErrors.push(...rowErrors);
  }
  for (let i = 0; i < data.bookings.length; i++) {
    const rowErrors = await validateBookingRow(data.bookings[i], i + 1);
    validationErrors.push(...rowErrors);
  }
  for (let i = 0; i < data.debits.length; i++) {
    const rowErrors = await validateDebitRow(data.debits[i], i + 1);
    validationErrors.push(...rowErrors);
  }

  // Add validation errors to errors array
  for (const ve of validationErrors) {
    errors.push(`Dòng ${ve.row} (${ve.field}): ${ve.message}`);
  }

  // If there are validation errors, stop here and log
  if (validationErrors.length > 0) {
    await prisma.importLog.update({
      where: { id: importLogId },
      data: {
        status: 'failed',
        errorDetails: JSON.stringify(validationErrors),
        completedAt: new Date(),
      },
    });
    return { created: 0, updated: 0, errors, validationErrors };
  }

  // 1. Upsert tracking sheets
  for (let i = 0; i < data.sheets.length; i++) {
    const row = data.sheets[i];
    const tempIndex = i + 1;

    try {
      const result = await upsertTrackingSheet(row, tempIndex, 0);
      if (result) {
        createdSheets.set(tempIndex, result.id);
        if (result.action === 'created') created++;
        else updated++;
      }
    } catch (e) {
      errors.push(`Dòng ${tempIndex} (${row.containerNumber}): ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 2. Upsert job orders
  for (const o of data.orders) {
    const realId = await resolveSheetId(String(o.sheetId), createdSheets);
    if (!realId) {
      errors.push(`Job Order type="${o.type}": sheetId "${o.sheetId}" không hợp lệ`);
      continue;
    }
    try {
      const action = await upsertJobOrder(o, realId);
      if (action === 'created') created++;
      else updated++;
    } catch (e) {
      errors.push(`Job Order sheetId=${realId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 3. Upsert job bookings
  for (const b of data.bookings) {
    const realId = await resolveSheetId(String(b.sheetId), createdSheets);
    if (!realId) {
      errors.push(`Job Booking type="${b.type}": sheetId "${b.sheetId}" không hợp lệ`);
      continue;
    }
    try {
      const action = await upsertJobBooking(b, realId);
      if (action === 'created') created++;
      else updated++;
    } catch (e) {
      errors.push(`Job Booking sheetId=${realId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 4. Upsert debit notes
  for (const d of data.debits) {
    const realId = await resolveSheetId(String(d.sheetId), createdSheets);
    if (!realId) {
      errors.push(`Debit Note type="${d.type}": sheetId "${d.sheetId}" không hợp lệ`);
      continue;
    }
    try {
      const action = await upsertDebitNote(d, realId);
      if (action === 'created') created++;
      else updated++;
    } catch (e) {
      errors.push(`Debit Note sheetId=${realId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Update import log
  await prisma.importLog.update({
    where: { id: importLogId },
    data: {
      status: errors.length > 0 ? 'partial' : 'completed',
      totalRows: data.sheets.length + data.orders.length + data.bookings.length + data.debits.length,
      successRows: created + updated,
      errorRows: errors.length,
      errorDetails: errors.length > 0 ? JSON.stringify(errors) : null,
      completedAt: new Date(),
    },
  });

  return { created, updated, errors, validationErrors };
}

export { ParsedImportData };
export type { ImportResult, ValidationError };