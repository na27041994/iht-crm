import ExcelJS from 'exceljs';
import { vndText } from '../../lib/money.js';

// Xuất Excel debit khổ ngang khớp mẫu cũ:
// Mã phiếu | Consignee | Từ (From) | Đến (To) | Ghi chú | Số bill | Ngày ETA/ETD | Custom No | Ngày tờ khai |
// Số container | GW (kg) | Số lượng container | Invoice No | Mô tả | Unit |
// Số lượng | Giá VND | Tiền thuế | Tổng tiền
// Mỗi job: dòng info + từng dòng debit liền mạch (không dòng subtotal ngăn cách);
// cuối cùng dòng TOTAL AMT.

// Chuẩn tiền x100: DB lưu *100, xuất chia 100
const MONEY_SCALE = 100;
function numMoney(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n / MONEY_SCALE;
}
// GW text nhiều dòng: số -> number, text -> giữ nguyên
function numOrText(v: unknown): number | string | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n;
}

// VAT 1 dòng debit (đơn vị hiển thị).
// Thuế 5% theo hóa đơn thực tế: thuế = tổng x 5% (trước thuế = tổng x 95%), làm tròn đồng.
function vatAmount(d: any): number {
  const qty = Number(d.quantity ?? 1);
  const taxRate = Number(d.taxRate ?? 0);
  let unitPrice = 0;
  if (d.currency === 'USD') unitPrice = (Number(d.priceUsd ?? 0) / MONEY_SCALE) * Number(d.exchangeRate ?? 0);
  else unitPrice = Number(d.priceVnd ?? 0) / MONEY_SCALE;
  if (unitPrice === 0 && d.total != null) {
    const total = Number(d.total) / MONEY_SCALE;
    if (taxRate === 5) {
      const pretax = Math.round(total * 95 / 100);
      return Math.round((total - pretax) * 100) / 100;
    }
    const pretax = taxRate ? total / (1 + taxRate / 100) : total;
    return Math.round((total - pretax) * 100) / 100;
  }
  if (taxRate === 5) return Math.round(unitPrice * qty * 5 / 95);
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

// Tên cột theo đúng nhãn nhập liệu trên web (bỏ cột Red Invoice No vì luôn trống)
const HEADERS = [
  'Mã phiếu', 'Consignee', 'Từ (From)', 'Đến (To)', 'Ghi chú', 'Số bill', 'Ngày ETA/ETD', 'Custom No', 'Ngày tờ khai',
  'Số container', 'GW (kg)', 'Số lượng container', 'Invoice No', 'Mô tả', 'Unit',
  'Số lượng', 'Giá VND', 'Tiền thuế', 'Tổng tiền',
];
const WIDTHS = [13, 12, 10, 10, 14, 17, 12, 19, 12, 14, 10, 10, 12, 34, 8, 9, 13, 13, 14];

// Thêm 1 dòng 20 cột, dòng dữ liệu không xuống dòng (tiền/GW ghi text chuẩn Việt)
function lrow(ws: ExcelJS.Worksheet, values: unknown[], o: { bold?: boolean } = {}): ExcelJS.Row {
  const row = ws.addRow(values);
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    if (o.bold) cell.font = { bold: true, size: 10 };
    else cell.font = { size: 10 };
    cell.alignment = { vertical: 'middle', wrapText: false };
    // Giá VND(17) / Tiền thuế(18) / Tổng tiền(19) / GW(11): số -> text chuẩn Việt
    if ((colNumber === 17 || colNumber === 18 || colNumber === 19 || colNumber === 11) && typeof cell.value === 'number') {
      cell.value = vndText(cell.value);
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
      numOrText(s.gw) ?? '',
      s.containerQuantity ?? '',
    ];
    let jVat = 0;
    let jTotal = 0;
    // Mỗi dòng debit lặp đầy đủ thông tin job (khớp mẫu cũ)
    debits.forEach((dd) => {
      const vat = vatAmount(dd);
      const price = unitPrice(dd);
      const amt = numMoney(dd.total) ?? 0;
      jVat = Math.round((jVat + vat) * 100) / 100;
      jTotal = Math.round((jTotal + amt) * 100) / 100;
      lrow(ws, [
        ...jobInfo,
        // Invoice No dòng trống thì lấy số của phiếu
        dd.invoiceNumber ?? (s as any).invoiceNumber ?? '',
        dd.description ?? dd.type,
        dd.unit ?? '',
        dd.quantity != null ? Number(dd.quantity) : '',
        price ?? '',
        vat,
        amt,
      ]);
    });
    if (!debits.length) {
      lrow(ws, [...jobInfo, '', '', '', '', '', '', '']);
    }
    gVat = Math.round((gVat + jVat) * 100) / 100;
    gTotal = Math.round((gTotal + jTotal) * 100) / 100;
  }

  // TOTAL AMT cuối (nhãn ở cột Mô tả)
  lrow(ws, [...Array(13).fill(''), 'TOTAL AMT', '', '', '', gVat, gTotal], { bold: true });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}
