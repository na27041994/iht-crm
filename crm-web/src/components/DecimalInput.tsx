'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from 'antd';
import { formatEnDecimalInput, formatMoneyInput, parseEnDecimalInput, parseMoneyInput } from '@/lib/numberFormat';

interface DecimalInputProps {
  value?: number | null;
  onChange?: (v: number | undefined) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  // Chuẩn hiển thị: 'vi' = 1.000,56 (mặc định), 'en' = 1,000.56
  locale?: 'vi' | 'en';
  format?: (v: any) => string;
  parse?: (v: any) => string;
  // Giới hạn số thập phân (VD: 3 -> 1,000.567)
  maxDecimals?: number;
}

// Nhập số thập phân kiểu VN (VD: 1.000,56):
// - giữ nguyên dấu phẩy đang gõ dở (InputNumber thường ăn mất)
// - blur mới format chuẩn, form luôn nhận number
export default function DecimalInput({ value, onChange, placeholder, style, disabled, locale = 'vi', format, parse, maxDecimals }: DecimalInputProps) {
  const fmt = format ?? (locale === 'en' ? formatEnDecimalInput : formatMoneyInput);
  const prs = parse ?? (locale === 'en' ? parseEnDecimalInput : parseMoneyInput);
  // Cắt phần thập phân theo maxDecimals (nếu có)
  function capDec(parsed: string): string {
    if (maxDecimals == null || parsed === '' || parsed === '-') return parsed;
    const i = parsed.indexOf('.');
    if (i < 0) return parsed;
    return parsed.slice(0, i + 1 + maxDecimals);
  }
  const decRe = maxDecimals == null ? '\\d*' : `\\d{0,${maxDecimals}}`;
  const [text, setText] = useState(value == null ? '' : fmt(value));
  const focused = useRef(false);
  const textRef = useRef(text);
  textRef.current = text;

  // Đồng bộ khi form nạp giá trị mới (sửa phiếu), trừ lúc đang gõ
  useEffect(() => {
    if (!focused.current) {
      const t = value == null ? '' : fmt(value);
      textRef.current = t;
      setText(t);
    }
  }, [value, fmt]);

  function pushNumber(raw: string) {
    const parsed = capDec(prs(raw));
    const num = parsed === '' || parsed === '-' ? undefined : Number(parsed);
    onChange?.(num == null || Number.isNaN(num) ? undefined : num);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/-/g, '');
    // đang gõ phần thập phân dở (vi: ",xx" / en: ".xx") -> giữ nguyên text
    const partial =
      locale === 'en'
        ? raw.includes('.') && new RegExp(`^[\\d\\s,]*\\.${decRe}$`).test(raw)
        : raw.includes(',') && new RegExp(`^[\\d\\s.]*,${decRe}$`).test(raw);
    if (partial) {
      textRef.current = raw;
      setText(raw);
    } else {
      const t = raw === '' ? '' : fmt(capDec(prs(raw)));
      textRef.current = t;
      setText(t);
    }
    pushNumber(raw);
  }

  return (
    <Input
      value={text}
      placeholder={placeholder ?? (locale === 'en' ? 'VD: 1,000.56' : 'VD: 1.000,56')}
      style={style}
      disabled={disabled}
      inputMode="decimal"
      onChange={handleChange}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        const p = capDec(prs(textRef.current));
        const t = p === '' || p === '-' ? '' : fmt(p);
        textRef.current = t;
        setText(t);
      }}
    />
  );
}
