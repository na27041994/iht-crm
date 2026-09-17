'use client';

import { useRef, useState } from 'react';
import { AutoComplete } from 'antd';
import { apiFetch } from '@/lib/api';

interface Props {
  type: 'order' | 'booking' | 'debit';
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

export default function DescriptionAutocomplete({ type, value, onChange, placeholder }: Props) {
  const [options, setOptions] = useState<{ value: string }[]>([]);
  const timeout = useRef<NodeJS.Timeout | null>(null);

  async function fetchOptions(search: string) {
    try {
      const params = new URLSearchParams({ type, limit: '20' });
      if (search) params.set('search', search);
      const data = await apiFetch<string[]>(`/tracking-sheets/descriptions?${params}`);
      setOptions(data.map((d) => ({ value: d })));
    } catch {
      setOptions([]);
    }
  }

  function handleSearch(v: string) {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => fetchOptions(v), 250);
  }

  return (
    <AutoComplete
      value={value}
      options={options}
      onSearch={handleSearch}
      onChange={onChange}
      onFocus={() => fetchOptions('')}
      placeholder={placeholder ?? 'Mô tả nội dung'}
      allowClear
      filterOption={false}
    />
  );
}
