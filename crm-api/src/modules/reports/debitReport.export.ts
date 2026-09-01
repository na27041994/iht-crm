import ExcelJS from 'exceljs';
import { iterateDebitItems } from './report.service.js';
import type { DebitGroup } from './report.service.js';

const HEADER_FILL = 'FF1F4E79';

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

// Hàm setupSheet: xử lý setupSheet
function setupSheet(ws: ExcelJS.Worksheet, columns: Partial<ExcelJS.Column>[]) {
  ws.columns = columns;
  styleHeader(ws.getRow(1));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

const SUMMARY_COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: 'STT', key: 'stt', width: 6 },
  { header: 'Đối tượng', key: 'name', width: 34 },
  { header: 'Số dòng', key: 'rowCount', width: 10 },
  { header: 'Số phiếu', key: 'sheetCount', width: 10 },
  { header: 'Số job', key: 'rowCount', width: 10 },
  { header: 'Tổng tiền', key: 'totalAmount', width: 18, style: { numFmt: '#,##0.00' } },
];

const DETAIL_COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: 'Mã phiếu', key: 'sheetNumber', width: 16 },
  { header: 'Loại', key: 'type', width: 18 },
  { header: 'Số hóa đơn', key: 'invoiceNumber', width: 16 },
  { header: 'Mô tả', key: 'description', width: 28 },
  { header: 'Khách hàng', key: 'customerName', width: 30 },
  { header: 'SL', key: 'quantity', width: 8 },
  { header: 'Tiền tệ', key: 'currency', width: 10 },
  { header: 'Ngày', key: 'date', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
  { header: 'Số tiền', key: 'amount', width: 15, style: { numFmt: '#,##0.00' } },
];

// Hàm addSummarySheet: xử lý addSummarySheet
function addSummarySheet(wb: ExcelJS.Workbook, title: string, entityLabel: string, groups: DebitGroup[]) {
  const ws = wb.addWorksheet(title);
  setupSheet(ws, SUMMARY_COLUMNS);
  ws.getColumn('name').header = entityLabel;
  groups.forEach((g, i) => {
    ws.addRow({ stt: i + 1, name: g.name, rowCount: g.rowCount, sheetCount: g.sheetCount, totalAmount: g.totalAmount });
  });
  const total = groups.reduce((s, g) => s + g.totalAmount, 0);
  const sumRow = ws.addRow({
    name: 'Tổng cộng',
    rowCount: groups.reduce((s, g) => s + g.rowCount, 0),
    sheetCount: groups.reduce((s, g) => s + g.sheetCount, 0),
    totalAmount: total,
  });
  sumRow.font = { bold: true };
}

// Hàm buildDebitReportWorkbook: xử lý buildDebitReportWorkbook
export async function buildDebitReportWorkbook(
  data: {
    customers: DebitGroup[];
    types?: DebitGroup[];
  },
  from?: Date,
  to?: Date,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'I.H.T Logistics';
  wb.created = new Date();

  addSummarySheet(wb, 'Khach hang', 'Khách hàng', data.customers);
  if (data.types?.length) addSummarySheet(wb, 'Loai', 'Loại', data.types);

  const wsDetail = wb.addWorksheet('Chi tiet');
  setupSheet(wsDetail, DETAIL_COLUMNS);
  for await (const it of iterateDebitItems(from, to)) {
    wsDetail.addRow({
      sheetNumber: it.sheetNumber,
      type: it.type,
      invoiceNumber: it.invoiceNumber ?? '',
      description: it.description ?? '',
      customerName: it.customerName,
      quantity: it.quantity ?? '',
      currency: it.currency ?? '',
      date: new Date(it.date),
      amount: it.amount,
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

// Hàm buildDebitSelectedWorkbook: xử lý buildDebitSelectedWorkbook
export async function buildDebitSelectedWorkbook(sheets: any[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'I.H.T Logistics';
  wb.created = new Date();

  const ws = wb.addWorksheet('Debit da chon');
  setupSheet(ws, [
    { header: 'STT', key: 'stt', width: 6 },
    { header: 'Mã phiếu', key: 'sheetNumber', width: 16 },
    { header: 'Khách hàng', key: 'customer', width: 28 },
    { header: 'Số Debit', key: 'count', width: 10 },
    { header: 'Tổng tiền', key: 'total', width: 16, style: { numFmt: '#,##0.00' } },
  ]);

  sheets.forEach((s: any, i: number) => {
    // Hàm total: xử lý total
    const total = (s.debitNotes || []).reduce((sum: number, d: any) => sum + Number(d.total ?? 0), 0);
    ws.addRow({
      stt: i + 1,
      sheetNumber: s.sheetNumber,
      customer: s.customer ? s.customer.companyName || s.customer.customerName : '',
      count: s.debitNotes?.length ?? 0,
      total,
    });
  });

  if (sheets.length) {
    const total = sheets.reduce((sum: number, s: any) => sum + (s.debitNotes || []).reduce((a: number, d: any) => a + Number(d.total ?? 0), 0), 0);
    const sumRow = ws.addRow({ customer: 'Tổng cộng', total });
    sumRow.font = { bold: true };
  }

  // chi tiết
  const ws2 = wb.addWorksheet('Chi tiet');
  setupSheet(ws2, DETAIL_COLUMNS);
  for (const s of sheets) {
    for (const d of s.debitNotes || []) {
      ws2.addRow({
        sheetNumber: s.sheetNumber,
        type: d.type,
        invoiceNumber: d.invoiceNumber ?? '',
        description: d.description ?? '',
        customerName: s.customer ? s.customer.companyName || s.customer.customerName : '',
        quantity: d.quantity ? Number(d.quantity) : '',
        currency: d.currency ?? '',
        date: d.createdAt ? new Date(d.createdAt) : new Date(),
        amount: Number(d.total ?? 0),
      });
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
