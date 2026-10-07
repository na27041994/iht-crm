import ExcelJS from 'exceljs';
import { vndText } from '../../lib/money.js';
import { iterateDebitItems, splitDebitTax } from './report.service.js';
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
  { header: 'Tổng tiền', key: 'totalAmount', width: 18 },
];

const DETAIL_COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: 'Mã phiếu', key: 'sheetNumber', width: 16 },
  { header: 'Mã KH', key: 'customerCode', width: 12 },
  { header: 'Khách hàng', key: 'customerName', width: 30 },
  { header: 'Loại (gộp)', key: 'types', width: 28 },
  { header: 'Số dòng', key: 'rowCount', width: 10 },
  { header: 'Ngày', key: 'date', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
  { header: 'Tiền trước thuế', key: 'pretaxAmount', width: 16 },
  { header: 'Tiền thuế', key: 'taxAmount', width: 15 },
  { header: 'Số tiền', key: 'amount', width: 15 },
];

const MONEY_SCALE = 100;
// Hàm addSummarySheet: xử lý addSummarySheet
function addSummarySheet(wb: ExcelJS.Workbook, title: string, entityLabel: string, groups: DebitGroup[]) {
  const ws = wb.addWorksheet(title);
  setupSheet(ws, SUMMARY_COLUMNS);
  ws.getColumn('name').header = entityLabel;
  groups.forEach((g, i) => {
    ws.addRow({ stt: i + 1, name: g.name, rowCount: g.rowCount, sheetCount: g.sheetCount, totalAmount: vndText(g.totalAmount / MONEY_SCALE) });
  });
  const total = groups.reduce((s, g) => s + g.totalAmount / MONEY_SCALE, 0);
  const sumRow = ws.addRow({
    name: 'Tổng cộng',
    rowCount: groups.reduce((s, g) => s + g.rowCount, 0),
    sheetCount: groups.reduce((s, g) => s + g.sheetCount, 0),
    totalAmount: vndText(total),
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

  // Gộp 1 phiếu nhiều loại thành 1 dòng (không liệt kê từng dòng chi tiết)
  const wsDetail = wb.addWorksheet('Chi tiet');
  setupSheet(wsDetail, DETAIL_COLUMNS);
  const groups = new Map<number, {
    sheetNumber: string;
    customerCode: string;
    customerName: string;
    types: string[];
    rowCount: number;
    date: Date;
    pretax: number;
    tax: number;
    total: number;
  }>();
  for await (const it of iterateDebitItems(from, to)) {
    let g = groups.get(it.sheetId);
    if (!g) {
      g = {
        sheetNumber: it.sheetNumber,
        customerCode: it.customerCode ?? '',
        customerName: it.customerName,
        types: [],
        rowCount: 0,
        date: new Date(it.date),
        pretax: 0,
        tax: 0,
        total: 0,
      };
      groups.set(it.sheetId, g);
    }
    if (it.type && !g.types.includes(it.type)) g.types.push(it.type);
    g.rowCount += 1;
    g.pretax += it.pretaxAmount;
    g.tax += it.taxAmount;
    g.total += it.amount;
  }
  for (const g of groups.values()) {
    wsDetail.addRow({
      sheetNumber: g.sheetNumber,
      customerCode: g.customerCode,
      customerName: g.customerName,
      types: g.types.join(', '),
      rowCount: g.rowCount,
      date: g.date,
      pretaxAmount: vndText(g.pretax / MONEY_SCALE),
      taxAmount: vndText(g.tax / MONEY_SCALE),
      amount: vndText(g.total / MONEY_SCALE),
    });
  }
  const gTotal = [...groups.values()].reduce((s, g) => s + g.total, 0);
  if (groups.size) {
    const sumRow = wsDetail.addRow({
      customerName: 'Tổng cộng',
      rowCount: [...groups.values()].reduce((s, g) => s + g.rowCount, 0),
      pretaxAmount: vndText([...groups.values()].reduce((s, g) => s + g.pretax, 0) / MONEY_SCALE),
      taxAmount: vndText([...groups.values()].reduce((s, g) => s + g.tax, 0) / MONEY_SCALE),
      amount: vndText(gTotal / MONEY_SCALE),
    });
    sumRow.font = { bold: true };
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
    { header: 'Tổng tiền', key: 'total', width: 16 },
  ]);

  sheets.forEach((s: any, i: number) => {
    // Hàm total: xử lý total
    const total = (s.debitNotes || []).reduce((sum: number, d: any) => sum + Number(d.total ?? 0) / MONEY_SCALE, 0);
    ws.addRow({
      stt: i + 1,
      sheetNumber: s.sheetNumber,
      customer: s.customer ? s.customer.companyName || s.customer.customerName : '',
      count: s.debitNotes?.length ?? 0,
      total: vndText(total),
    });
  });

  if (sheets.length) {
    const total = sheets.reduce((sum: number, s: any) => sum + (s.debitNotes || []).reduce((a: number, d: any) => a + Number(d.total ?? 0) / MONEY_SCALE, 0), 0);
    const sumRow = ws.addRow({ customer: 'Tổng cộng', total: vndText(total) });
    sumRow.font = { bold: true };
  }

  // chi tiết
  const ws2 = wb.addWorksheet('Chi tiet');
  setupSheet(ws2, DETAIL_COLUMNS);
  for (const s of sheets) {
    for (const d of s.debitNotes || []) {
      const { pretax, tax } = splitDebitTax(d.total, d.taxRate);
      ws2.addRow({
        sheetNumber: s.sheetNumber,
        customerCode: s.customer?.code ?? '',
        type: d.type,
        invoiceNumber: d.invoiceNumber ?? '',
        description: d.description ?? '',
        customerName: s.customer ? s.customer.companyName || s.customer.customerName : '',
        quantity: d.quantity ? Number(d.quantity) : '',
        currency: d.currency ?? '',
        date: d.createdAt ? new Date(d.createdAt) : new Date(),
        pretaxAmount: vndText(pretax / MONEY_SCALE),
        taxAmount: vndText(tax / MONEY_SCALE),
        amount: vndText(Number(d.total ?? 0) / MONEY_SCALE),
      });
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
