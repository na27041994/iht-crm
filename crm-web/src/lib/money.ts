// Chuẩn tiền: lưu nguyên đã nhân 100, hiển thị chia 100
export const MONEY_SCALE = 100;

export function toScaled(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return Math.round(n * MONEY_SCALE);
}

export function fromScaled(v: number | string | null | undefined): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n / MONEY_SCALE;
}

export function formatScaled(v: number | string | null | undefined): string {
  if (v == null || v === '') return '-';
  const n = Number(v);
  if (Number.isNaN(n)) return '-';
  return (n / MONEY_SCALE).toLocaleString('vi-VN');
}

export function formatScaledQty(v: string | number | null | undefined): string {
  if (v == null || v === '') return '-';
  const n = Number(v);
  if (Number.isNaN(n)) return '-';
  // qty không scale, giữ nguyên
  return n.toLocaleString('vi-VN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
