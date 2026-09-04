import ExcelJS from 'exceljs';

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

// Hàm buildAdvanceVouchersWorkbook: xử lý buildAdvanceVouchersWorkbook
export async function buildAdvanceVouchersWorkbook(vouchers: any[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'I.H.T Logistics';
  wb.created = new Date();

  const ws = wb.addWorksheet('Phieu chi');
  setupSheet(ws, [
    { header: 'STT', key: 'stt', width: 6 },
    { header: 'Số phiếu', key: 'advanceNo', width: 14 },
    { header: 'Loại', key: 'type', width: 16 },
    { header: 'Ngày chi', key: 'advanceDate', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Tiền tệ', key: 'currency', width: 10 },
    { header: 'Phiếu theo dõi', key: 'sheetNumber', width: 16 },
    { header: 'Khách hàng', key: 'customer', width: 28 },
    { header: 'Người tạo', key: 'createdBy', width: 18 },
    { header: 'Tổng tiền', key: 'totalAmount', width: 16, style: { numFmt: '#,##0.00' } },
    { header: 'Ghi chú', key: 'note', width: 24 },
  ]);

  vouchers.forEach((v, i) => {
    ws.addRow({
      stt: i + 1,
      advanceNo: v.advanceNo,
      type: v.type,
      advanceDate: v.advanceDate ? new Date(v.advanceDate) : null,
      currency: v.currency,
      sheetNumber: v.sheet?.sheetNumber ?? '',
      customer: v.customer ? v.customer.companyName || v.customer.customerName : '',
      createdBy: v.createdBy?.fullName ?? '',
      totalAmount: Number(v.totalAmount ?? 0) / 100,
      note: v.note ?? '',
    });
  });

  const total = vouchers.reduce((s, v) => s + Number(v.totalAmount ?? 0) / 100, 0);
  const sumRow = ws.addRow({
    customer: 'Tổng cộng',
    totalAmount: total,
  });
  sumRow.font = { bold: true };
  sumRow.getCell('customer').alignment = { horizontal: 'right' } as any;

  // Chi tiết items (nếu cần)
  if (vouchers.some((v) => v.items?.length)) {
    const ws2 = wb.addWorksheet('Chi tiet');
    setupSheet(ws2, [
      { header: 'Số phiếu', key: 'advanceNo', width: 14 },
      { header: 'Loại', key: 'type', width: 16 },
      { header: 'Số tiền', key: 'amount', width: 16, style: { numFmt: '#,##0.00' } },
      { header: 'Ghi chú', key: 'note', width: 30 },
    ]);
    for (const v of vouchers) {
      for (const it of v.items ?? []) {
        ws2.addRow({
          advanceNo: v.advanceNo,
          type: v.type,
          amount: Number(it.amount) / 100,
          note: it.note ?? '',
        });
      }
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
