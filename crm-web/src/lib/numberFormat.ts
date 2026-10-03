// Chuẩn hiển thị số tiền Việt Nam: nghìn = ., thập phân = ,
// VD: 9692956.52 -> "9.692.956,52"
export function formatMoneyInput(value: any): string {
  if (value == null || value === '') return '';
  const str = `${value}`.trim();
  if (str === '' || str === '-') return str;
  // tách phần nguyên và thập phân (chấp nhận cả . và , nhập vào)
  // vì InputNumber truyền raw number nên thường chỉ có . thập phân
  const normalized = str.replace(/\s/g, '');
  // tìm dấu thập phân cuối (nếu có cả . và ,)
  let intPart = normalized;
  let decPart = '';
  const lastDot = normalized.lastIndexOf('.');
  const lastComma = normalized.lastIndexOf(',');
  if (lastComma > lastDot) {
    // đã dạng vi-VN: 9.692.956,52
    intPart = normalized.slice(0, lastComma).replace(/\./g, '');
    decPart = normalized.slice(lastComma + 1).replace(/\D/g, '');
  } else if (lastDot >= 0) {
    // dạng raw: 9692956.52
    intPart = normalized.slice(0, lastDot).replace(/[^\d-]/g, '');
    decPart = normalized.slice(lastDot + 1).replace(/\D/g, '');
  } else {
    intPart = normalized.replace(/[^\d-]/g, '');
  }
  const sign = intPart.startsWith('-') ? '-' : '';
  const digits = intPart.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (decPart) return `${sign}${grouped || '0'},${decPart}`;
  return `${sign}${grouped}`;
}

/** Parse "9.692.956,52" -> "9692956.52" để InputNumber lưu số */
export function parseMoneyInput(value: any): string {
  if (value == null || value === '') return '';
  const str = `${value}`.trim();
  if (str === '' || str === '-') return str;
  // bỏ dấu nghìn ., đổi dấu thập phân , thành .
  const noThousand = str.replace(/\./g, '');
  const withDot = noThousand.replace(/,/g, '.');
  // chỉ giữ số, - và 1 dấu .
  const parts = withDot.split('.');
  if (parts.length <= 1) return withDot.replace(/[^\d-]/g, '');
  const int = parts[0].replace(/[^\d-]/g, '');
  const dec = parts.slice(1).join('').replace(/\D/g, '');
  return dec ? `${int}.${dec}` : int;
}

// Chuẩn Anh cho NW/GW: nghìn = ,, thập phân = . (VD: 1000.56 -> "1,000.56")
export function formatEnDecimalInput(value: any): string {
  if (value == null || value === '') return '';
  const str = `${value}`.trim();
  if (str === '' || str === '-') return str;
  const normalized = str.replace(/\s/g, '').replace(/,/g, '');
  const dot = normalized.indexOf('.');
  let intPart = normalized;
  let decPart = '';
  if (dot >= 0) {
    intPart = normalized.slice(0, dot).replace(/[^\d-]/g, '');
    decPart = normalized.slice(dot + 1).replace(/\D/g, '');
  } else {
    intPart = normalized.replace(/[^\d-]/g, '');
  }
  const sign = intPart.startsWith('-') ? '-' : '';
  const digits = intPart.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (decPart) return `${sign}${grouped || '0'}.${decPart}`;
  return `${sign}${grouped}`;
}

/** Parse "1,000.56" -> "1000.56" */
export function parseEnDecimalInput(value: any): string {
  if (value == null || value === '') return '';
  const str = `${value}`.trim();
  if (str === '' || str === '-') return str;
  const noThousand = str.replace(/,/g, '').replace(/\s/g, '');
  const parts = noThousand.split('.');
  if (parts.length <= 1) return noThousand.replace(/[^\d-]/g, '');
  const int = parts[0].replace(/[^\d-]/g, '');
  const dec = parts.slice(1).join('').replace(/\D/g, '');
  return dec ? `${int}.${dec}` : int;
}
