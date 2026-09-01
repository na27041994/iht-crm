import ExcelJS from 'exceljs';
import { iterateRefundItems } from './report.service.js';
import type { RefundGroup } from './report.service.js';

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
  { header: 'Tổng tiền hoàn', key: 'totalAmount', width: 18, style: { numFmt: '#,##0.00' } },
];

const DETAIL_COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: 'Mã phiếu', key: 'sheetNumber', width: 16 },
  { header: 'Nguồn', key: 'source', width: 14 },
  { header: 'Loại', key: 'type', width: 18 },
  { header: 'Mô tả', key: 'description', width: 28 },
  { header: 'Khách hàng', key: 'customerName', width: 30 },
  { header: 'Ngày', key: 'date', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
  { header: 'Số tiền', key: 'amount', width: 15, style: { numFmt: '#,##0.00' } },
];

// Hàm addSummarySheet: xử lý addSummarySheet
function addSummarySheet(wb: ExcelJS.Workbook, title: string, entityLabel: string, groups: RefundGroup[]) {
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

// Hàm buildRefundReportWorkbook: xử lý buildRefundReportWorkbook
export async function buildRefundReportWorkbook(
  data: {
    customers: RefundGroup[];
    types?: RefundGroup[];
  },
  from?: Date,
  to?: Date,
  type?: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'I.H.T Logistics';
  wb.created = new Date();

  addSummarySheet(wb, 'Khach hang', 'Khách hàng', data.customers);
  if (data.types?.length) addSummarySheet(wb, 'Loai', 'Loại', data.types);

  const wsDetail = wb.addWorksheet('Chi tiet');
  setupSheet(wsDetail, DETAIL_COLUMNS);
  for await (const it of iterateRefundItems(from, to, type)) {
    wsDetail.addRow({
      sheetNumber: it.sheetNumber,
      source: it.source === 'booking' ? 'Job Book tàu' : 'Job Order',
      type: it.type,
      description: it.description ?? '',
      customerName: it.customerName,
      date: new Date(it.date),
      amount: it.amount,
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
