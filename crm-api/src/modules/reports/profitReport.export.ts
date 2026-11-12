import ExcelJS from 'exceljs';
import { vndText } from '../../lib/money.js';
import type { ProfitRow } from './report.service.js';

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
    cell.alignment = { vertical: 'middle', wrapText: false };
  });
  row.height = 20;
}

const MONEY_SCALE = 100;
// Hàm buildProfitWorkbook: xử lý buildProfitWorkbook
export async function buildProfitWorkbook(
  items: ProfitRow[],
  totals: { totalRevenue: number; totalServiceFees: number; totalCuocFees: number; totalProfit: number },
  from?: Date,
  to?: Date,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'I.H.T Logistics';
  wb.created = new Date();

  const ws = wb.addWorksheet('Loi nhuan');
  ws.columns = [
    { header: 'Mã phiếu', key: 'sheetNumber', width: 16 },
    { header: 'Mã khách hàng', key: 'customerCode', width: 14 },
    { header: 'Tên khách hàng', key: 'customerName', width: 30 },
    { header: 'Tiền thanh toán', key: 'revenue', width: 18, style: { numFmt: '#,##0.00' } },
    { header: 'Chi phí', key: 'serviceFees', width: 16, style: { numFmt: '#,##0.00' } },
    { header: 'Lợi nhuận', key: 'profit', width: 16, style: { numFmt: '#,##0.00' } },
  ];
  styleHeader(ws.getRow(1));
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  items.forEach((r, i) => {
    ws.addRow({
      sheetNumber: r.sheetNumber,
      customerCode: r.customerCode ?? '',
      customerName: r.customerName,
      revenue: vndText(r.revenue / MONEY_SCALE),
      serviceFees: vndText(r.serviceFees / MONEY_SCALE),
      profit: vndText(r.profit / MONEY_SCALE),
    });
  });

  const sumRow = ws.addRow({
    sheetNumber: 'TỔNG CỘNG',
    customerName: 'Tổng cộng',
    revenue: vndText(totals.totalRevenue / MONEY_SCALE),
    serviceFees: vndText(totals.totalServiceFees / MONEY_SCALE),
    profit: vndText(totals.totalProfit / MONEY_SCALE),
  });
  sumRow.font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
