// Chuẩn tiền: lưu số nguyên đã nhân 100, hiển thị chia 100 (không đổi đơn vị)
export const MONEY_SCALE = 100;

/** Nhân 100 và làm tròn half-up để lưu DB (5 tăng, <5 giảm).
 * Chuẩn hóa qua chuỗi thập phân + EPSILON để tránh lỗi float
 * (VD: 1000.005*100 trong float = 100000.4999... -> Math.round thường sẽ làm tròn xuống sai) */
export function toScaled(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return Math.round(Number(n.toFixed(10)) * MONEY_SCALE + Number.EPSILON);
}

/** Chia 100 để hiển thị */
export function fromScaled(v: number | string | null | undefined): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n / MONEY_SCALE;
}

/** Format tiền đã lưu scaled: chia 100 rồi format vi-VN */
export function formatScaled(v: number | string | null | undefined): string {
  if (v == null || v === '') return '-';
  const n = Number(v);
  if (Number.isNaN(n)) return '-';
  return (n / MONEY_SCALE).toLocaleString('vi-VN');
}
