import ExcelJS from 'exceljs';
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
    cell.alignment = { vertical: 'middle', wrapText: true };
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
    { header: 'STT', key: 'stt', width: 6 },
    { header: 'Mã phiếu', key: 'sheetNumber', width: 16 },
    { header: 'Khách hàng', key: 'customerName', width: 30 },
    { header: 'Ngày', key: 'date', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Doanh thu (Debit)', key: 'revenue', width: 18, style: { numFmt: '#,##0.00' } },
    { header: 'Tổng phí (chưa thuế)', key: 'totalFees', width: 18, style: { numFmt: '#,##0.00' } },
    { header: 'Cược (Cont + sửa chữa)', key: 'cuocFees', width: 18, style: { numFmt: '#,##0.00' } },
    { header: 'Phí dịch vụ', key: 'serviceFees', width: 16, style: { numFmt: '#,##0.00' } },
    { header: 'Lợi nhuận', key: 'profit', width: 16, style: { numFmt: '#,##0.00' } },
  ];
  styleHeader(ws.getRow(1));
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  items.forEach((r, i) => {
    ws.addRow({
      stt: i + 1,
      sheetNumber: r.sheetNumber,
      customerName: r.customerName,
      date: new Date(r.date),
      revenue: r.revenue / MONEY_SCALE,
      totalFees: r.totalFees / MONEY_SCALE,
      cuocFees: r.cuocFees / MONEY_SCALE,
      serviceFees: r.serviceFees / MONEY_SCALE,
      profit: r.profit / MONEY_SCALE,
    });
  });

  const sumRow = ws.addRow({
    sheetNumber: 'TỔNG CỘNG',
    revenue: totals.totalRevenue / MONEY_SCALE,
    totalFees: (totals.totalServiceFees + totals.totalCuocFees) / MONEY_SCALE,
    cuocFees: totals.totalCuocFees / MONEY_SCALE,
    serviceFees: totals.totalServiceFees / MONEY_SCALE,
    profit: totals.totalProfit / MONEY_SCALE,
  });
  sumRow.font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
