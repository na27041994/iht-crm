'use client';

import { DatePicker as AntdDatePicker } from 'antd';
import React from 'react';

// Tự thêm dấu / khi gõ ngày dd/mm/yyyy (gõ 15092026 -> 15/09/2026).
// Bắt sự kiện input ở capture (chạy trước handler của antd), viết lại value
// rồi dispatch lại event để antd đọc giá trị đã format.
function autoSlash(target: EventTarget | null) {
  const el = target as HTMLInputElement | null;
  if (!el || el.tagName !== 'INPUT') return;
  const input = el as HTMLInputElement;
  const digits = input.value.replace(/\D/g, '').slice(0, 8);
  if (!digits) return;
  let out = digits;
  if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
  if (out === input.value) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(input, out);
  else input.value = out;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function onInputCapture(e: React.FormEvent<HTMLSpanElement>) {
  autoSlash(e.target);
}

function SlashWrapper({ children }: { children: React.ReactNode }) {
  // display: contents để không vỡ layout của antd picker
  return (
    <span onInputCapture={onInputCapture} style={{ display: 'contents' }}>
      {children}
    </span>
  );
}

export function SlashDatePicker(props: React.ComponentProps<typeof AntdDatePicker>) {
  return (
    <SlashWrapper>
      <AntdDatePicker {...props} />
    </SlashWrapper>
  );
}

export function SlashRangePicker(props: React.ComponentProps<typeof AntdDatePicker.RangePicker>) {
  const Range = AntdDatePicker.RangePicker;
  return (
    <SlashWrapper>
      <Range {...(props as any)} />
    </SlashWrapper>
  );
}
