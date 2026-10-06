import ExcelJS from 'exceljs';
import type { TrackingSheetWithRelations } from './trackingSheet.service.js';
import type { Prisma } from '@prisma/client';

const HEADER_FILL = 'FF1F4E79';

export type JobExportType = 'order' | 'booking' | 'debit';

// Hàm styleHeader: xử lý styleHeader
function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  row.height = 20;
}

// Chuẩn tiền x100: DB lưu *100, xuất chia 100
const MONEY_SCALE = 100;
function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
function numMoney(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n / MONEY_SCALE;
}

// Hàm dateCell: xử lý dateCell
function dateCell(v: Date | string | null): Date | string | null {
  return v ?? null;
}

// Hàm setupSheet: xử lý setupSheet
function setupSheet(ws: ExcelJS.Worksheet, columns: Partial<ExcelJS.Column>[]) {
  ws.columns = columns;
  styleHeader(ws.getRow(1));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

const JOB_ORDER_COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: 'Mã phiếu', key: 'sheetNumber', width: 16 },
  { header: 'Khách hàng', key: 'customer', width: 30 },
  { header: 'Phân loại', key: 'type', width: 18 },
  { header: 'Mô tả', key: 'description', width: 28 },
  { header: 'NV giao nhận', key: 'deliveryStaff', width: 18 },
  { header: 'Trước thuế', key: 'pretaxAmount', width: 15, style: { numFmt: '#,##0.00' } },
  { header: 'Thuế (%)', key: 'taxRate', width: 10 },
  { header: 'Thành Tiền', key: 'portAmt', width: 15, style: { numFmt: '#,##0.00' } },
  { header: 'Ghi chú', key: 'note', width: 26 },
];

const JOB_BOOKING_COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: 'Mã phiếu', key: 'sheetNumber', width: 16 },
  { header: 'Khách hàng', key: 'customer', width: 30 },
  { header: 'Loại', key: 'type', width: 18 },
  { header: 'Mô tả', key: 'description', width: 28 },
  { header: 'Đơn vị tính', key: 'unit', width: 12 },
  { header: 'Số lượng', key: 'quantity', width: 10 },
  { header: 'Trước thuế', key: 'pretaxAmount', width: 15, style: { numFmt: '#,##0.00' } },
  { header: 'Thuế (%)', key: 'taxRate', width: 10 },
  { header: 'Tiền thuế', key: 'taxAmount', width: 15, style: { numFmt: '#,##0.00' } },
  { header: 'Sau thuế', key: 'afterTaxAmount', width: 15, style: { numFmt: '#,##0.00' } },
  { header: 'Tổng tiền', key: 'total', width: 15, style: { numFmt: '#,##0.00' } },
  { header: 'Ghi chú', key: 'note', width: 26 },
];

const DEBIT_NOTE_COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: 'Mã phiếu', key: 'sheetNumber', width: 16 },
  { header: 'Khách hàng', key: 'customer', width: 30 },
  { header: 'Loại', key: 'type', width: 18 },
  { header: 'Invoice No', key: 'invoiceNumber', width: 17 },
  { header: 'Mô tả', key: 'description', width: 28 },
  { header: 'Unit', key: 'unit', width: 10 },
  { header: 'Current', key: 'currency', width: 9 },
  { header: 'Số lượng', key: 'quantity', width: 10 },
  { header: 'Giá VND', key: 'priceVnd', width: 15, style: { numFmt: '#,##0.00' } },
  { header: 'Giá USD', key: 'priceUsd', width: 13, style: { numFmt: '#,##0.00' } },
  { header: 'Tỷ giá', key: 'exchangeRate', width: 12, style: { numFmt: '#,##0.00' } },
  { header: 'Thuế (%)', key: 'taxRate', width: 10 },
  { header: 'Tổng tiền', key: 'total', width: 15, style: { numFmt: '#,##0.00' } },
];

// Hàm jobOrderRow: xử lý jobOrderRow
function jobOrderRow(s: TrackingSheetWithRelations, o: TrackingSheetWithRelations['jobOrders'][number]) {
  return {
    sheetNumber: s.sheetNumber,
    customer: s.customer?.companyName ?? '',
    type: o.type,
    description: o.description ?? '',
    deliveryStaff: (o as any).deliveryStaff?.fullName ?? '',
    pretaxAmount: numMoney((o as any).pretaxAmount),
    taxRate: num((o as any).taxRate),
    portAmt: numMoney(o.portAmt),
    note: o.note ?? '',
  };
}

// Hàm jobBookingRow: xử lý jobBookingRow
function jobBookingRow(s: TrackingSheetWithRelations, b: TrackingSheetWithRelations['jobBookings'][number]) {
  return {
    sheetNumber: s.sheetNumber,
    customer: s.customer?.companyName ?? '',
    type: b.type,
    description: b.description ?? '',
    unit: b.unit ?? '',
    quantity: num(b.quantity),
    pretaxAmount: numMoney(b.pretaxAmount),
    taxRate: num(b.taxRate),
    taxAmount: numMoney(b.taxAmount),
    afterTaxAmount: numMoney(b.afterTaxAmount),
    total: numMoney(b.total),
    note: (b as any).note ?? '',
  };
}

// Hàm debitNoteRow: xử lý debitNoteRow
function debitNoteRow(s: TrackingSheetWithRelations, d: TrackingSheetWithRelations['debitNotes'][number]) {
  return {
    sheetNumber: s.sheetNumber,
    customer: s.customer?.companyName ?? '',
    type: d.type,
    invoiceNumber: d.invoiceNumber ?? '',
    description: d.description ?? '',
    unit: d.unit ?? '',
    currency: d.currency,
    quantity: num(d.quantity),
    priceVnd: numMoney(d.priceVnd),
    priceUsd: numMoney(d.priceUsd),
    exchangeRate: num(d.exchangeRate),
    taxRate: num(d.taxRate),
    total: numMoney(d.total),
  };
}

// Tạo workbook Excel phiếu theo dõi
export async function buildTrackingSheetsWorkbook(sheets: TrackingSheetWithRelations[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'I.H.T Logistics';
  wb.created = new Date();

  const wsSheet = wb.addWorksheet('Phieu theo doi');
  setupSheet(wsSheet, [
    { header: 'Mã phiếu', key: 'sheetNumber', width: 16 },
    { header: 'Mã khách hàng', key: 'customerCode', width: 14 },
    { header: 'Khách hàng', key: 'customer', width: 30 },
    { header: 'Mã số thuế', key: 'taxCode', width: 16 },
    { header: 'Số container', key: 'containerNumber', width: 16 },
    { header: 'Số lượng container', key: 'containerQuantity', width: 16 },
    { header: 'Từ (From)', key: 'fromLocation', width: 22 },
    { header: 'Đến (To)', key: 'toLocation', width: 22 },
    { header: 'Phân Luồng', key: 'phanLuong', width: 14 },
    { header: 'NW (kg)', key: 'nw', width: 11 },
    { header: 'GW (kg)', key: 'gw', width: 11 },
    { header: 'Ngày ETA/ETD', key: 'etaDate', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Custom No', key: 'customNo', width: 15 },
    { header: 'Ngày tờ khai', key: 'declarationDate', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Số bill', key: 'billNumber', width: 17 },
    { header: 'Invoice No', key: 'invoiceNumber', width: 17 },
    { header: 'Consignee', key: 'consignee', width: 26 },
    { header: 'Shipper', key: 'shipper', width: 26 },
    { header: 'Ghi chú', key: 'note', width: 26 },
    { header: 'Ngày tạo', key: 'createdAt', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Người tạo', key: 'createdBy', width: 20 },
  ]);
  for (const s of sheets) {
    wsSheet.addRow({
      sheetNumber: s.sheetNumber,
      customer: s.customer ? `${s.customer.companyName} (#${s.customer.id})` : '',
      customerCode: (s.customer as any)?.code ?? '',
      taxCode: (s.customer as any)?.taxCode ?? '',
      containerNumber: s.containerNumber ?? '',
      containerQuantity: (s as any).containerQuantity ?? '',
      fromLocation: s.fromLocation ?? '',
      toLocation: s.toLocation ?? '',
      phanLuong: (s as any).phanLuong ?? '',
      nw: num(s.nw),
      gw: num(s.gw),
      etaDate: dateCell(s.etaDate),
      customNo: s.customNo ?? '',
      declarationDate: dateCell(s.declarationDate),
      billNumber: s.billNumber ?? '',
      invoiceNumber: s.invoiceNumber ?? '',
      consignee: (s as any).consignee ?? '',
      shipper: (s as any).shipper ?? '',
      note: s.note ?? '',
      createdAt: dateCell(s.createdAt),
      createdBy: (s as any).createdBy?.fullName ?? '',
    });
  }

  const wsOrder = wb.addWorksheet('Job Order');
  setupSheet(wsOrder, JOB_ORDER_COLUMNS);
  for (const s of sheets) for (const o of s.jobOrders) wsOrder.addRow(jobOrderRow(s, o));

  const wsBooking = wb.addWorksheet('Job Book tau');
  setupSheet(wsBooking, JOB_BOOKING_COLUMNS);
  for (const s of sheets) for (const b of s.jobBookings) wsBooking.addRow(jobBookingRow(s, b));

  const wsDebit = wb.addWorksheet('Debit Note');
  setupSheet(wsDebit, DEBIT_NOTE_COLUMNS);
  for (const s of sheets) for (const d of s.debitNotes) wsDebit.addRow(debitNoteRow(s, d));

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Tạo file mẫu Excel để import
export async function buildImportTemplateWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'I.H.T Logistics';
  wb.created = new Date();

  const HDR_STYLE = {
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 } as any,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } } as any,
    border: { top: { style: 'thin' as const }, left: { style: 'thin' as const }, bottom: { style: 'thin' as const }, right: { style: 'thin' as const } } as any,
    alignment: { vertical: 'middle' as const, wrapText: true } as any,
  };

  // Hàm styleHdr: xử lý styleHdr
  function styleHdr(ws: ExcelJS.Worksheet, rowNum = 1) {
    ws.getRow(rowNum).eachCell((c) => {
      c.font = HDR_STYLE.font;
      c.fill = HDR_STYLE.fill;
      c.border = HDR_STYLE.border;
      c.alignment = HDR_STYLE.alignment;
    });
    ws.getRow(rowNum).height = 22;
  }

  // Hàm setup: xử lý setup
  function setup(ws: ExcelJS.Worksheet, cols: Partial<ExcelJS.Column>[]) {
    ws.columns = cols;
    styleHdr(ws);
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }

  const SHEET_COLS: Partial<ExcelJS.Column>[] = [
    { header: 'sheetNumber (trống=thêm mới, có mã=sửa)', key: 'sheetNumber', width: 26 },
    { header: 'containerNumber', key: 'containerNumber', width: 18 },
    { header: 'customerId', key: 'customerId', width: 12 },
    { header: 'fromLocation', key: 'fromLocation', width: 18 },
    { header: 'toLocation', key: 'toLocation', width: 18 },
    { header: 'containerQuantity', key: 'containerQuantity', width: 14 },
    { header: 'etaDate (YYYY-MM-DD)', key: 'etaDate', width: 18 },
    { header: 'nw', key: 'nw', width: 10 },
    { header: 'gw', key: 'gw', width: 10 },
    { header: 'customNo', key: 'customNo', width: 15 },
    { header: 'declarationDate (YYYY-MM-DD)', key: 'declarationDate', width: 18 },
    { header: 'billNumber', key: 'billNumber', width: 15 },
    { header: 'invoiceNumber', key: 'invoiceNumber', width: 15 },
    { header: 'phanLuong', key: 'phanLuong', width: 14 },
    { header: 'note', key: 'note', width: 25 },
    { header: 'createdById', key: 'createdById', width: 12 },
    { header: 'consignee', key: 'consignee', width: 26 },
    { header: 'shipper', key: 'shipper', width: 26 },
  ];

  const wsSheet = wb.addWorksheet('Phieu theo doi');
  setup(wsSheet, SHEET_COLS);
  wsSheet.addRow({
    sheetNumber: '',
    containerNumber: 'MSKU1234567',
    customerId: 1,
    fromLocation: 'Hà Nội',
    toLocation: 'TP.HCM',
    containerQuantity: '1',
    etaDate: '2026-09-15',
    nw: 20000,
    gw: 22000,
    customNo: 'HD2026001',
    declarationDate: '2026-09-10',
    billNumber: 'BILL001',
    invoiceNumber: 'INV001',
    phanLuong: 'Xanh',
    note: 'Ghi chú mẫu',
    createdById: 1,
    consignee: 'CONG TY C',
    shipper: 'CONG TY S',
  });

  const ORDER_COLS: Partial<ExcelJS.Column>[] = [
    { header: 'sheetId* (số thứ tự hoặc mã phiếu)', key: 'sheetId', width: 24 },
    { header: 'type*', key: 'type', width: 20 },
    { header: 'description', key: 'description', width: 22 },
    { header: 'pretaxAmount', key: 'pretaxAmount', width: 14 },
    { header: 'taxRate', key: 'taxRate', width: 10 },
    { header: 'portAmt', key: 'portAmt', width: 14 },
    { header: 'deliveryStaffId', key: 'deliveryStaffId', width: 14 },
    { header: 'industry', key: 'industry', width: 12 },
    { header: 'note', key: 'note', width: 20 },
  ];
  const wsOrder = wb.addWorksheet('Job Order');
  setup(wsOrder, ORDER_COLS);
  wsOrder.addRow({ sheetId: 1, type: 'Chi Trực Tiếp', description: 'Cước tàu', pretaxAmount: 5000000, taxRate: 10, portAmt: 5500000, deliveryStaffId: '', industry: '', note: 'Mẫu job order' });

  const BOOKING_COLS: Partial<ExcelJS.Column>[] = [
    { header: 'sheetId* (số thứ tự hoặc mã phiếu)', key: 'sheetId', width: 24 },
    { header: 'type*', key: 'type', width: 20 },
    { header: 'description', key: 'description', width: 22 },
    { header: 'unit', key: 'unit', width: 10 },
    { header: 'quantity', key: 'quantity', width: 10 },
    { header: 'pretaxAmount', key: 'pretaxAmount', width: 14 },
    { header: 'taxRate', key: 'taxRate', width: 10 },
    { header: 'note', key: 'note', width: 20 },
  ];
  const wsBooking = wb.addWorksheet('Job Booking');
  setup(wsBooking, BOOKING_COLS);
  wsBooking.addRow({ sheetId: 1, type: 'Cược Cont', description: 'Cước tàu', unit: 'Cont', quantity: 1, pretaxAmount: 5000000, taxRate: 10, note: 'Mẫu job booking' });

  const DEBIT_COLS: Partial<ExcelJS.Column>[] = [
    { header: 'sheetId*', key: 'sheetId', width: 10 },
    { header: 'type*', key: 'type', width: 18 },
    { header: 'invoiceNumber', key: 'invoiceNumber', width: 15 },
    { header: 'description', key: 'description', width: 22 },
    { header: 'unit', key: 'unit', width: 10 },
    { header: 'currency', key: 'currency', width: 10 },
    { header: 'quantity', key: 'quantity', width: 10 },
    { header: 'priceVnd', key: 'priceVnd', width: 14 },
    { header: 'taxRate', key: 'taxRate', width: 10 },
    { header: 'priceUsd', key: 'priceUsd', width: 12 },
    { header: 'exchangeRate', key: 'exchangeRate', width: 12 },
  ];
  const wsDebit = wb.addWorksheet('Debit Note');
  setup(wsDebit, DEBIT_COLS);
  wsDebit.addRow({ sheetId: 1, type: 'Local charges', invoiceNumber: 'INV001', description: 'Local charges', unit: 'Cont', currency: 'VND', quantity: 1, priceVnd: 5000000, taxRate: 8, priceUsd: 200, exchangeRate: 25000 });

  const wsInstr = wb.addWorksheet('Hướng dẫn');
  wsInstr.columns = [{ width: 120 }];
  wsInstr.addRow(['HƯỚNG DẪN NHẬP EXCEL NHANH']);
  wsInstr.addRow(['']);
  wsInstr.addRow(['1. Sheet "Phieu theo doi": Mỗi dòng = 1 phiếu.']);
  wsInstr.addRow(['   - THÊM MỚI: để trống cột sheetNumber, hệ thống tự sinh mã phiếu (VD: J260918-001).']);
  wsInstr.addRow(['   - SỬA: nhập mã phiếu có sẵn vào cột sheetNumber (mã giữ nguyên, các cột khác ghi đè). Mã không tồn tại -> báo lỗi dòng đó.']);
  wsInstr.addRow(['   - containerNumber/customerId không bắt buộc. customerId, deliveryStaffId, createdById: nhập ID từ hệ thống.']);
  wsInstr.addRow(['   - Ngày nhập định dạng YYYY-MM-DD (ví dụ: 2026-09-15).']);
  wsInstr.addRow(['']);
  wsInstr.addRow(['2. Sheet "Job Order", "Job Booking", "Debit Note": TÙY CHỌN.']);
  wsInstr.addRow(['   - sheetId: số thứ tự 1,2,3... tương ứng dòng trong sheet "Phieu theo doi" của cùng file, HOẶC mã phiếu có sẵn (VD: J260918-001).']);
  wsInstr.addRow(['   - type: nhập đúng tên loại trong hệ thống (ví dụ: "Cược Cont", "Cược sửa chữa cont", "Our Company Pay"...).']);
  wsInstr.addRow(['']);
  wsInstr.addRow(['3. Quy trình import:']);
  wsInstr.addRow(['   a. Điền sheet "Phieu theo doi" (bắt buộc).']);
  wsInstr.addRow(['   b. (Tuỳ chọn) Điền Job Order / Job Booking / Debit Note.']);
  wsInstr.addRow(['   c. Upload file .xlsx qua API /tracking-sheets/import-excel.']);
  wsInstr.addRow(['   d. Hệ thống tạo phiếu, rồi tự điền sheetId cho các sheet con, tạo job orders/bookings/debits.']);
  wsInstr.addRow(['']);
  wsInstr.addRow(['4. Tải file mẫu này: GET /api/tracking-sheets/import-template']);
  wsInstr.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };
  wsInstr.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Tạo workbook Excel theo loại job
// Tính VAT 1 dòng debit (đơn vị hiển thị, khớp bản in)
function debitVatAmount(d: any): number {
  const qty = Number(d.quantity ?? 1);
  const taxRate = Number(d.taxRate ?? 0);
  let unitPrice = 0;
  if (d.currency === 'USD') unitPrice = (Number(d.priceUsd ?? 0) / MONEY_SCALE) * Number(d.exchangeRate ?? 0);
  else unitPrice = Number(d.priceVnd ?? 0) / MONEY_SCALE;
  if (unitPrice === 0 && d.total != null) {
    const total = Number(d.total) / MONEY_SCALE;
    const pretax = taxRate ? total / (1 + taxRate / 100) : total;
    return Math.round((total - pretax) * 100) / 100;
  }
  return Math.round(unitPrice * qty * (taxRate / 100) * 100) / 100;
}
function debitUnitPrice(d: any): number | null {
  if (d.currency === 'USD' && d.priceUsd != null) return (Number(d.priceUsd) / MONEY_SCALE) * Number(d.exchangeRate ?? 0);
  if (d.priceVnd != null) return Number(d.priceVnd) / MONEY_SCALE;
  return null;
}
function fmtDMY(v: any): string {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function fmtWtX(v: any): string {
  if (v == null || v === '') return '';
  const n = Number(v);
  if (Number.isNaN(n)) return '';
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

// Thêm 1 dòng 8 cột không viền (khớp PDF mẫu), căn lề + số tiền #,##0.00
interface XRowOpts {
  bold?: boolean;
  size?: number;
  fill?: string;
  center?: boolean;
  right?: boolean;
  money?: boolean;
}
function xrow(ws: ExcelJS.Worksheet, values: unknown[], o: XRowOpts = {}): ExcelJS.Row {
  const row = ws.addRow(values);
  row.eachCell({ includeEmpty: true }, (cell) => {
    if (o.bold || o.size) cell.font = { bold: !!o.bold, size: o.size ?? 11 };
    if (o.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.fill } };
    if (o.money && typeof cell.value === 'number') cell.numFmt = '#,##0.00';
    cell.alignment = {
      horizontal: o.center ? 'center' : o.right ? 'right' : 'left',
      vertical: 'middle',
      wrapText: true,
    };
  });
  return row;
}
function xmerge(ws: ExcelJS.Worksheet, row: ExcelJS.Row, from: number, to: number) {
  ws.mergeCells(row.number, from, row.number, to);
}

// Tổng VAT + tiền 1 job (đơn vị hiển thị)
function debitSheetTotals(s: any): { vat: number; total: number; tamUng: number; serviceFee: number } {
  const debits: any[] = s.debitNotes ?? [];
  let totalVat = 0;
  let totalAmt = 0;
  debits.forEach((dd) => {
    totalVat = Math.round((totalVat + debitVatAmount(dd)) * 100) / 100;
    totalAmt = Math.round((totalAmt + Number(dd.total ?? 0) / MONEY_SCALE) * 100) / 100;
  });
  const tamUng =
    Math.round(
      ((s.advanceVouchers ?? []) as any[])
        .filter((v) => v.type === 'Chi tạm ứng')
        .reduce(
          (sum, v) => sum + ((v.items ?? []) as any[]).filter((it: any) => it.kind !== 'Giảm trừ').reduce((a, it: any) => a + Number(it.amount ?? 0), 0),
          0,
        ) / 100 * 100,
    ) / 100;
  return { vat: totalVat, total: totalAmt, tamUng, serviceFee: Math.round((totalAmt - tamUng) * 100) / 100 };
}

// Header mẫu in: công ty + RECEIVE
function writeDebitHeader(ws: ExcelJS.Worksheet, s: any) {
  const customer = s.customer ?? {};
  const contactName = s.deliveryStaff?.fullName ?? s.docStaff?.fullName ?? '';
  const contactPhone = s.deliveryStaff?.phone ?? s.docStaff?.phone ?? '';
  const d = new Date();
  const today = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

  let r = xrow(ws, ['I.H.T VIET NAM CO., LTD', '', '', '', '', '', '', ''], { bold: true, size: 14, center: true });
  xmerge(ws, r, 1, 8);
  r = xrow(ws, ['Add: 108 Ý Lan, Phường Phú Thạnh, TP.HCM', '', '', '', '', '', '', ''], { bold: true, center: true });
  xmerge(ws, r, 1, 8);
  r = xrow(ws, ['Tel: 08-38380888 / 08-39225100 ; Fax: 08-39225105 / 08-39225106', '', '', '', '', '', '', ''], { bold: true, center: true });
  xmerge(ws, r, 1, 8);
  r = xrow(ws, ['DEBIT NOTE', '', '', '', '', '', '', ''], { bold: true, size: 16, center: true });
  xmerge(ws, r, 1, 8);

  r = xrow(ws, ['RECEIVE', '', 'Date:', today, '', '', '', ''], { bold: true, center: true });
  xmerge(ws, r, 1, 2);
  // Hàng Date nền đỏ (khớp mẫu)
  for (let c = 3; c <= 8; c++) {
    const cell = r.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
  }
  r = xrow(ws, ['To:', customer.companyName ?? '', '', '', 'Please Contact With:', contactName, '', ''], { bold: true });
  xmerge(ws, r, 2, 4);
  xmerge(ws, r, 6, 8);
  r = xrow(ws, ['Attn:', customer.contactPerson ?? '', '', '', 'Accountting:', contactPhone, '', ''], { bold: true });
  xmerge(ws, r, 2, 4);
  xmerge(ws, r, 6, 8);
  r = xrow(ws, ['Add:', customer.address ?? '', '', '', '', '', '', ''], { bold: true });
  xmerge(ws, r, 2, 8);
  r = xrow(ws, ['Tel:', customer.phone ?? '', '', '', '', '', '', ''], { bold: true });
  xmerge(ws, r, 2, 8);
  r = xrow(ws, ['Fax:', customer.fax ?? '', '', '', '', '', '', ''], { bold: true });
  xmerge(ws, r, 2, 8);
}

// Khối 1 job: info + items + JOB AMT (+ vàng/chi hộ khi có tạm ứng), trả về tổng
function writeDebitJobBlock(ws: ExcelJS.Worksheet, s: any): { vat: number; total: number } {
  const jobInfo: Array<[string, string, string, string]> = [
    ['From:', s.fromLocation ?? '', 'To:', s.toLocation ?? ''],
    ['Customs No:', s.customNo ?? '', 'Custom Date:', fmtDMY(s.declarationDate)],
    ['NW:', s.nw != null ? fmtWtX(s.nw) : '', 'GW:', s.gw != null ? fmtWtX(s.gw) : ''],
    ['Job Order:', s.sheetNumber, 'Note:', s.carrier?.carrierName ?? s.note ?? ''],
    ['QTY:', s.containerQuantity != null ? String(s.containerQuantity) : s.containerNumber ?? '', 'Invoices No:', ''],
    ['Po No:', s.billNumber ?? '', 'Bill No:', s.billNumber ?? ''],
    ['Container No:', s.containerNumber ?? '', '', ''],
  ];
  for (const [l1, v1, l2, v2] of jobInfo) {
    const r = xrow(ws, [l1, v1, '', '', l2, v2, '', ''], { bold: true });
    xmerge(ws, r, 2, 4);
    xmerge(ws, r, 6, 8);
  }

  xrow(ws, ['STT', 'Descriptions', 'Invoice No', 'Unit', 'Qty', 'Price', 'VAT Tax', 'Total Amt'], { bold: true, center: true });
  const debits: any[] = s.debitNotes ?? [];
  const t = debitSheetTotals(s);
  debits.forEach((dd, idx) => {
    const vat = debitVatAmount(dd);
    const price = debitUnitPrice(dd);
    const amt = Number(dd.total ?? 0) / MONEY_SCALE;
    xrow(
      ws,
      [idx + 1, dd.description ?? dd.type, dd.invoiceNumber ?? '', dd.unit ?? '', dd.quantity != null ? Number(dd.quantity) : '', price, vat ? vat : '-', amt],
      { money: true },
    );
  });
  const pretaxTotal = Math.round((t.total - t.vat) * 100) / 100;
  let r = xrow(ws, ['', '', '', '', '', 'JOB AMT', t.vat ? t.vat : '00', t.total], { bold: true, right: true, money: true });
  xmerge(ws, r, 1, 5);
  if (t.tamUng > 0) {
    r = xrow(ws, ['', '', '', '', 'TỔNG CỘNG 合計', pretaxTotal, t.vat ? t.vat : '-', t.total], { bold: true, right: true, money: true, fill: 'FFFFFF00' });
    xmerge(ws, r, 1, 4);
    r = xrow(ws, ['', '', '', '', '', '', 'CHI HỘ 代墊費', t.tamUng], { bold: true, right: true, money: true });
    xmerge(ws, r, 1, 6);
    r = xrow(ws, ['', '', '', '', '', '', 'PHÍ DỊCH VỤ IHT - 服務費', t.serviceFee], { bold: true, right: true, money: true });
    xmerge(ws, r, 1, 6);
  }
  return { vat: t.vat, total: t.total };
}

// Bank + chữ ký cuối
function writeDebitBankSign(ws: ExcelJS.Worksheet) {
  const bankLines = [
    'We are looking forwards to reveiving your payment in the soonest time.',
    'If you have further infomation, please do not hesitate to contact with us.',
    'Also you can settle the payment to:',
    'Banker name: NGÂN HÀNG Á CHÂU- CN CHỢ LỚN',
    'Account no: 162000589',
    'Account name: CTY TNHH TM DV VẬN CHUYỂN I.H.T VIỆT NAM',
  ];
  for (const line of bankLines) {
    const r = xrow(ws, [line, '', '', '', '', '', '', ''], { bold: true });
    xmerge(ws, r, 1, 8);
  }
  xrow(ws, ['', 'SALE', '', '', 'ACCOUNTANT', '', 'APPROVAL', ''], { bold: true, center: true });
}

// Xuất Excel Debit Note theo đúng form bản in (1 job/khối, header 1 lần, TOTAL cuối)
export async function buildDebitTemplateWorkbook(s: any): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'I.H.T Logistics';
  wb.created = new Date();
  const ws = wb.addWorksheet('Debit Note');
  ws.columns = [
    { width: 6 }, { width: 32 }, { width: 16 }, { width: 10 },
    { width: 10 }, { width: 15 }, { width: 14 }, { width: 16 },
  ];

  writeDebitHeader(ws, s);
  writeDebitJobBlock(ws, s);
  writeDebitBankSign(ws);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

// Xuất Excel nhiều phiếu debit theo form in: 1 header chung + từng job + TOTAL AMT tổng cuối
export async function buildDebitMultiTemplateWorkbook(sheets: any[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'I.H.T Logistics';
  wb.created = new Date();
  const ws = wb.addWorksheet('Debit Note');
  ws.columns = [
    { width: 6 }, { width: 32 }, { width: 16 }, { width: 10 },
    { width: 10 }, { width: 15 }, { width: 14 }, { width: 16 },
  ];
  if (!sheets.length) {
    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
  }
  writeDebitHeader(ws, sheets[0]);
  let gVat = 0;
  let gTotal = 0;
  for (const s of sheets) {
    const t = writeDebitJobBlock(ws, s);
    gVat = Math.round((gVat + t.vat) * 100) / 100;
    gTotal = Math.round((gTotal + t.total) * 100) / 100;
  }
  const gPretax = Math.round((gTotal - gVat) * 100) / 100;
  const f = (n: number) => n;
  const r = xrow(ws, ['', '', '', '', 'TOTAL AMT', f(gPretax), gVat ? gVat : '-', f(gTotal)], { bold: true, right: true, money: true });
  xmerge(ws, r, 1, 4);
  writeDebitBankSign(ws);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

export async function buildJobsWorkbook(sheet: any, type: 'order' | 'booking' | 'debit'): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'I.H.T Logistics';
  wb.created = new Date();

  // Hàm setup: xử lý setup
  function setup(ws: ExcelJS.Worksheet, cols: Partial<ExcelJS.Column>[]) {
    ws.columns = cols;
    ws.getRow(1).eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 } as any;
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } } as any;
      c.border = { top: { style: 'thin' as const }, left: { style: 'thin' as const }, bottom: { style: 'thin' as const }, right: { style: 'thin' as const } } as any;
      c.alignment = { vertical: 'middle' as const, wrapText: true } as any;
    });
    ws.getRow(1).height = 20;
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }

  // Hàm num: xử lý num
  function num(v: unknown): number | null {
    if (v == null) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }
  function numMoney(v: unknown): number | null {
    if (v == null) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n / MONEY_SCALE;
  }

  if (type === 'order') {
    const ws = wb.addWorksheet('Job Order');
    setup(ws, [
      { header: 'Mã phiếu', key: 'sheetNumber', width: 16 },
      { header: 'Khách hàng', key: 'customer', width: 30 },
      { header: 'Phân loại', key: 'type', width: 18 },
      { header: 'Mô tả', key: 'description', width: 28 },
      { header: 'Hãng tàu / Đại lý', key: 'partner', width: 22 },
      { header: 'NV giao nhận', key: 'deliveryStaff', width: 18 },
      { header: 'Trước thuế', key: 'pretaxAmount', width: 15, style: { numFmt: '#,##0.00' } },
      { header: 'Thuế (%)', key: 'taxRate', width: 10 },
      { header: 'Thành Tiền', key: 'portAmt', width: 15, style: { numFmt: '#,##0.00' } },
      { header: 'Ghi chú', key: 'note', width: 26 },
    ]);
    for (const o of sheet.jobOrders) {
      ws.addRow({
        sheetNumber: sheet.sheetNumber,
        customer: sheet.customer ? `${sheet.customer.companyName} (#${sheet.customer.id})` : '',
        type: o.type,
        description: o.description ?? '',
        partner: (o as any).carrier?.carrierName ?? (o as any).agent?.agentName ?? (sheet as any).carrier?.carrierName ?? '',
        deliveryStaff: (o as any).deliveryStaff?.fullName ?? '',
        pretaxAmount: numMoney((o as any).pretaxAmount),
        taxRate: num((o as any).taxRate),
        portAmt: numMoney(o.portAmt),
        note: o.note ?? '',
      });
    }
  } else if (type === 'booking') {
    const ws = wb.addWorksheet('Job Book tau');
    setup(ws, [
      { header: 'Mã phiếu', key: 'sheetNumber', width: 16 },
      { header: 'Khách hàng', key: 'customer', width: 30 },
      { header: 'Loại', key: 'type', width: 18 },
      { header: 'Mô tả', key: 'description', width: 28 },
      { header: 'Hãng tàu / Đại lý', key: 'partner', width: 22 },
      { header: 'Đơn vị tính', key: 'unit', width: 12 },
      { header: 'Số lượng', key: 'quantity', width: 10 },
      { header: 'Trước thuế', key: 'pretaxAmount', width: 15, style: { numFmt: '#,##0.00' } },
      { header: 'Thuế (%)', key: 'taxRate', width: 10 },
      { header: 'Tiền thuế', key: 'taxAmount', width: 15, style: { numFmt: '#,##0.00' } },
      { header: 'Sau thuế', key: 'afterTaxAmount', width: 15, style: { numFmt: '#,##0.00' } },
      { header: 'Tổng tiền', key: 'total', width: 15, style: { numFmt: '#,##0.00' } },
      { header: 'Ghi chú', key: 'note', width: 26 },
    ]);
    for (const b of sheet.jobBookings) {
      ws.addRow({
        sheetNumber: sheet.sheetNumber,
        customer: sheet.customer ? `${sheet.customer.companyName} (#${sheet.customer.id})` : '',
        type: b.type,
        description: b.description ?? '',
        partner: (b as any).carrier?.carrierName ?? (b as any).agent?.agentName ?? (sheet as any).carrier?.carrierName ?? '',
        unit: b.unit ?? '',
        quantity: num(b.quantity),
        pretaxAmount: numMoney(b.pretaxAmount),
        taxRate: num(b.taxRate),
        taxAmount: numMoney(b.taxAmount),
        afterTaxAmount: numMoney(b.afterTaxAmount),
        total: numMoney(b.total),
        note: (b as any).note ?? '',
      });
    }
  } else {
    // Debit theo đúng form bản in
    return buildDebitTemplateWorkbook(sheet);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}