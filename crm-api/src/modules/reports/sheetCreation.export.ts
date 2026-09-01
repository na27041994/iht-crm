import ExcelJS from 'exceljs';
import { iterateSheetItems } from './report.service.js';
import type { SheetCreationGroup } from './report.service.js';

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

// Hàm buildSheetCreationWorkbook: xử lý buildSheetCreationWorkbook
export async function buildSheetCreationWorkbook(
  groups: SheetCreationGroup[],
  from?: Date,
  to?: Date,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'I.H.T Logistics';
  wb.created = new Date();

  const wsSummary = wb.addWorksheet('Nhan vien');
  setupSheet(wsSummary, [
    { header: 'STT', key: 'stt', width: 6 },
    { header: 'Nhân viên tạo', key: 'name', width: 30 },
    { header: 'Số phiếu đã tạo', key: 'sheetCount', width: 16 },
  ]);
  groups.forEach((g, i) => {
    wsSummary.addRow({ stt: i + 1, name: g.name, sheetCount: g.sheetCount });
  });
  const sumRow = wsSummary.addRow({
    name: 'Tổng cộng',
    sheetCount: groups.reduce((s, g) => s + g.sheetCount, 0),
  });
  sumRow.font = { bold: true };

  const wsDetail = wb.addWorksheet('Chi tiet');
  setupSheet(wsDetail, [
    { header: 'Nhân viên tạo', key: 'name', width: 26 },
    { header: 'Mã phiếu', key: 'sheetNumber', width: 16 },
    { header: 'Khách hàng', key: 'customerName', width: 32 },
    { header: 'Ngày tạo', key: 'createdAt', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
    { header: 'Ngày ETA', key: 'etaDate', width: 13, style: { numFmt: 'dd/mm/yyyy' } },
  ]);
  for (const g of groups) {
    for await (const it of iterateSheetItems(g.id, from, to)) {
      wsDetail.addRow({
        name: g.name,
        sheetNumber: it.sheetNumber,
        customerName: it.customerName,
        createdAt: new Date(it.createdAt),
        etaDate: it.etaDate ? new Date(it.etaDate) : '',
      });
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
