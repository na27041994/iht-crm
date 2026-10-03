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
}

// Nhập số thập phân kiểu VN (VD: 1.000,56):
// - giữ nguyên dấu phẩy đang gõ dở (InputNumber thường ăn mất)
// - blur mới format chuẩn, form luôn nhận number
export default function DecimalInput({ value, onChange, placeholder, style, disabled, locale = 'vi', format, parse }: DecimalInputProps) {
  const fmt = format ?? (locale === 'en' ? formatEnDecimalInput : formatMoneyInput);
  const prs = parse ?? (locale === 'en' ? parseEnDecimalInput : parseMoneyInput);
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
    const parsed = prs(raw);
    const num = parsed === '' || parsed === '-' ? undefined : Number(parsed);
    onChange?.(num == null || Number.isNaN(num) ? undefined : num);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/-/g, '');
    // đang gõ phần thập phân dở (vi: ",xx" / en: ".xx") -> giữ nguyên text
    const partial =
      locale === 'en'
        ? raw.includes('.') && /^[\d\s,]*\.\d*$/.test(raw)
        : raw.includes(',') && /^[\d\s.]*,\d*$/.test(raw);
    if (partial) {
      textRef.current = raw;
      setText(raw);
    } else {
      const t = raw === '' ? '' : fmt(raw);
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
        const p = prs(textRef.current);
        const t = p === '' || p === '-' ? '' : fmt(p);
        textRef.current = t;
        setText(t);
      }}
    />
  );
}
