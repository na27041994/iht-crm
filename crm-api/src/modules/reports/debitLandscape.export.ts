import ExcelJS from 'exceljs';

// Xuất Excel debit khổ ngang khớp mẫu cũ:
// Job No | Consignee | From | To | Note | Bill No | ETD/ETA | Customs No | Customs Date |
// Container No | GW | QTY | Invoice No | Red Invoice No | Description | Unit |
// Quantity | Price | Tax Amt | Total Amt
// Mỗi job: dòng info + từng dòng debit + dòng subtotal;
// cuối cùng dòng TOTAL AMT.

// Chuẩn tiền x100: DB lưu *100, xuất chia 100
const MONEY_SCALE = 100;
function numMoney(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n / MONEY_SCALE;
}

// VAT 1 dòng debit (đơn vị hiển thị)
function vatAmount(d: any): number {
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

function unitPrice(d: any): number | null {
  if (d.currency === 'USD' && d.priceUsd != null) return (Number(d.priceUsd) / MONEY_SCALE) * Number(d.exchangeRate ?? 0);
  if (d.priceVnd != null) return Number(d.priceVnd) / MONEY_SCALE;
  return null;
}

// Ngày kiểu mẫu cũ: YYYYMMDD
function fmtYMD(v: any): string {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

const HEADERS = [
  'Job No', 'Consignee', 'From', 'To', 'Note', 'Bill No', 'ETD/ETA', 'Customs No', 'Customs Date',
  'Container No', 'GW', 'QTY', 'Invoice No', 'Red Invoice No', 'Description', 'Unit',
  'Quantity', 'Price', 'Tax Amt', 'Total Amt',
];
const WIDTHS = [13, 12, 8, 8, 14, 17, 10, 19, 11, 14, 10, 8, 12, 13, 34, 8, 9, 13, 13, 14];

// Thêm 1 dòng 20 cột (money: Price/Tax/Total dạng #.##0,00; GW dạng châu Âu #.##0,00)
function lrow(ws: ExcelJS.Worksheet, values: unknown[], o: { bold?: boolean } = {}): ExcelJS.Row {
  const row = ws.addRow(values);
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    if (o.bold) cell.font = { bold: true, size: 10 };
    else cell.font = { size: 10 };
    cell.alignment = { vertical: 'middle', wrapText: true };
    // Price(18) / Tax Amt(19) / Total Amt(20)
    if ((colNumber === 18 || colNumber === 19 || colNumber === 20) && typeof cell.value === 'number') {
      cell.numFmt = '#.##0,00';
    }
    // GW(11) kiểu mẫu cũ: 19.413,77
    if (colNumber === 11 && typeof cell.value === 'number') {
      cell.numFmt = '#.##0,00';
    }
  });
  return row;
}

// Hàm buildDebitLandscapeWorkbook: xuất nhiều phiếu debit khổ ngang theo mẫu cũ
export async function buildDebitLandscapeWorkbook(sheets: any[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'I.H.T Logistics';
  wb.created = new Date();
  const ws = wb.addWorksheet('Debit ngang');
  ws.columns = WIDTHS.map((width) => ({ width }));
  ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } as any;

  const header = ws.addRow(HEADERS);
  header.font = { bold: true, size: 10 };
  header.alignment = { vertical: 'middle', wrapText: true };

  let gVat = 0;
  let gTotal = 0;

  for (const s of sheets) {
    const debits: any[] = s.debitNotes ?? [];
    // Thông tin job (chỉ dòng đầu của job)
    const jobInfo = [
      s.sheetNumber ?? '',
      (s as any).consignee ?? '',
      s.fromLocation ?? '',
      s.toLocation ?? '',
      s.note ?? '',
      s.billNumber ?? '',
      fmtYMD(s.etaDate),
      s.customNo ?? '',
      fmtYMD(s.declarationDate),
      s.containerNumber ?? '',
      s.gw != null && s.gw !== '' ? Number(s.gw) : '',
      s.containerQuantity ?? '',
    ];
    let jVat = 0;
    let jTotal = 0;
    debits.forEach((dd, idx) => {
      const vat = vatAmount(dd);
      const price = unitPrice(dd);
      const amt = numMoney(dd.total) ?? 0;
      jVat = Math.round((jVat + vat) * 100) / 100;
      jTotal = Math.round((jTotal + amt) * 100) / 100;
      lrow(ws, [
        ...(idx === 0 ? jobInfo : Array(12).fill('')),
        dd.invoiceNumber ?? '',
        '',
        dd.description ?? dd.type,
        dd.unit ?? '',
        dd.quantity != null ? Number(dd.quantity) : '',
        price ?? '',
        vat,
        amt,
      ]);
    });
    if (!debits.length) {
      lrow(ws, [...jobInfo, '', '', '', '', '', '', '', '']);
    }
    // Subtotal từng job dưới cột Tax Amt / Total Amt
    lrow(ws, [...Array(17).fill(''), '', jVat, jTotal], { bold: true });
    gVat = Math.round((gVat + jVat) * 100) / 100;
    gTotal = Math.round((gTotal + jTotal) * 100) / 100;
  }

  // TOTAL AMT cuối (nhãn ở cột Description)
  lrow(ws, [...Array(14).fill(''), 'TOTAL AMT', '', '', '', gVat, gTotal], { bold: true });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}
