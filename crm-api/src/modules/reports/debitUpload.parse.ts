import ExcelJS from 'exceljs';

const MAX_CODES = 5000;
const MAX_HEADER_CODES = 200;
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export interface ParsedSheetCodes {
  /** Mã phiếu hợp lệ, đã loại trùng, giữ thứ tự xuất hiện trong file */
  codes: string[];
  /** Tổng số dòng đọc được có nội dung */
  totalRows: number;
  /** Số dòng bị bỏ vì không hợp lệ (dòng tiêu đề, ghi chú...) */
  skipped: number;
}

function cleanCode(raw: unknown): string | null {
  if (raw == null) return null;
  let s = String(raw).replace(/\uFEFF/g, '').trim();
  if (!s) return null;
  if (s.length > 1 && s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1).trim();
  if (!CODE_PATTERN.test(s)) return null;
  return s;
}

// Hàm collectCodes: gom mã phiếu hợp lệ, loại trùng không phân biệt hoa thường
function collectCodes(values: unknown[]): ParsedSheetCodes {
  const seen = new Set<string>();
  const codes: string[] = [];
  let totalRows = 0;
  let skipped = 0;

  for (const value of values) {
    const code = cleanCode(value);
    if (!code) {
      if (String(value ?? '').trim()) skipped += 1;
      continue;
    }
    totalRows += 1;
    const key = code.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    codes.push(code);
    if (codes.length >= MAX_CODES) break;
  }

  return { codes, totalRows, skipped };
}

// Hàm parseCsv: đọc cột đầu tiên của từng dòng, phân tách bằng ; , hoặc tab
function parseCsv(text: string): ParsedSheetCodes {
  const rows = text.split(/\r\n|\n|\r/);
  return collectCodes(rows.map((row) => row.split(/[;,\t]/)[0]));
}

// Hàm parseXlsx: đọc cột đầu tiên của sheet đầu tiên
async function parseXlsx(buffer: Buffer): Promise<ParsedSheetCodes> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { codes: [], totalRows: 0, skipped: 0 };

  const values: unknown[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > MAX_CODES * 4) return;
    const cell = row.getCell(1);
    values.push(cell.text ?? cell.value);
  });

  return collectCodes(values);
}

// Hàm parseSheetCodeFile: nhận file CSV/TXT/XLSX, trả về danh sách mã phiếu hợp lệ
export async function parseSheetCodeFile(buffer: Buffer, originalname: string): Promise<ParsedSheetCodes> {
  const isXlsx = /\.xlsx$/i.test(originalname);
  if (isXlsx) return parseXlsx(buffer);

  const text = buffer.toString('utf8');
  if (!text.trim()) return { codes: [], totalRows: 0, skipped: 0 };

  if (text.includes('\u0000')) return parseXlsx(buffer);

  return parseCsv(text);
}

export function encodeMissingCodes(codes: string[]): string {
  return encodeURIComponent(codes.slice(0, MAX_HEADER_CODES).join('|'));
}