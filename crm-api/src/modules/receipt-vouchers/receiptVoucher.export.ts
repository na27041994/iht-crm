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

// Hàm buildReceiptVouchersWorkbook: xử lý buildReceiptVouchersWorkbook
export async function buildReceiptVouchersWorkbook(vouchers: any[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'I.H.T Logistics';
  wb.created = new Date();

  const ws = wb.addWorksheet('Phieu thu');
  setupSheet(ws, [
    { header: 'STT', key: 'stt', width: 6 },
    { header: 'Số phiếu', key: 'receiptNo', width: 14 },
    { header: 'Đối tượng', key: 'payerType', width: 14 },
    { header: 'Ngày thu', key: 'receiptDate', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Tiền tệ', key: 'currency', width: 10 },
    { header: 'Người nộp', key: 'payer', width: 32 },
    { header: 'Người tạo', key: 'createdBy', width: 18 },
    { header: 'NV thu', key: 'staff', width: 18 },
    { header: 'Số tiền', key: 'amount', width: 16, style: { numFmt: '#.##0,00' } },
    { header: 'Phí chuyển khoản', key: 'transFee', width: 16, style: { numFmt: '#.##0,00' } },
    { header: 'Lý do nộp', key: 'note', width: 30 },
  ]);

  vouchers.forEach((v, i) => {
    ws.addRow({
      stt: i + 1,
      receiptNo: v.receiptNo,
      payerType: v.payerType,
      receiptDate: v.receiptDate ? new Date(v.receiptDate) : null,
      currency: v.currency,
      payer: v.payerDisplay ?? (v.customer ? v.customer.companyName || v.customer.customerName : v.payerName ?? ''),
      createdBy: v.createdBy?.fullName ?? '',
      staff: v.staff?.fullName ?? v.createdBy?.fullName ?? '',
      amount: Number(v.amount ?? 0) / 100,
      transFee: Number(v.transFee ?? 0) / 100,
      note: v.note ?? '',
    });
  });

  const total = vouchers.reduce((s, v) => s + Number(v.amount ?? 0) / 100, 0);
  const sumRow = ws.addRow({
    payer: 'Tổng cộng',
    amount: total,
  });
  sumRow.font = { bold: true };
  sumRow.getCell('payer').alignment = { horizontal: 'right' } as any;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
