'use client';

import { useEffect, useState } from 'react';
import { App, Form, Input, Modal, Select } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { apiFetch } from '@/lib/api';
import { SlashRangePicker } from '@/components/SlashDatePicker';

export const LEAVE_TYPES = ['Nghỉ phép năm', 'Nghỉ ốm', 'Nghỉ việc riêng', 'Nghỉ thai sản', 'Nghỉ khác'] as const;

export interface LeaveItem {
  id: number;
  type: string;
  fromDate: string;
  toDate: string;
  reason: string | null;
}

interface LeaveRequestFormModalProps {
  open: boolean;
  editing: LeaveItem | null;
  onClose: () => void;
  onSaved: () => void;
}

// Số ngày nghỉ bao cả đầu + cuối
export function calcDays(from: Dayjs | null, to: Dayjs | null): number {
  if (!from || !to) return 0;
  const d = to.startOf('day').diff(from.startOf('day'), 'day') + 1;
  return d > 0 ? d : 0;
}

export default function LeaveRequestFormModal({ open, editing, onClose, onSaved }: LeaveRequestFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [days, setDays] = useState(0);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setDays(0);
    if (editing) {
      const f = dayjs(editing.fromDate);
      const t = dayjs(editing.toDate);
      form.setFieldsValue({ type: editing.type, range: [f, t], reason: editing.reason ?? '' });
      setDays(calcDays(f, t));
    }
  }, [open, editing, form]);

  async function handleSubmit(values: { type: string; range: [Dayjs, Dayjs]; reason?: string }) {
    if (!values.range?.[0] || !values.range?.[1]) {
      message.error('Chọn từ ngày và đến ngày');
      return;
    }
    setSaving(true);
    try {
      const body = {
        type: values.type,
        fromDate: values.range[0].format('YYYY-MM-DD'),
        toDate: values.range[1].format('YYYY-MM-DD'),
        reason: values.reason?.trim() ? values.reason.trim() : null,
      };
      if (editing) {
        await apiFetch(`/leave-requests/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
        message.success('Đã cập nhật đơn nghỉ phép');
      } else {
        await apiFetch('/leave-requests', { method: 'POST', body: JSON.stringify(body) });
        message.success('Đã gửi đơn nghỉ phép');
      }
      onSaved();
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={editing ? 'Sửa đơn nghỉ phép' : 'Xin nghỉ phép'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editing ? 'Lưu thay đổi' : 'Gửi đơn'}
      confirmLoading={saving}
      width={520}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
        <Form.Item label="Loại nghỉ" name="type" rules={[{ required: true, message: 'Chọn loại nghỉ' }]}>
          <Select placeholder="Chọn loại nghỉ" options={LEAVE_TYPES.map((t) => ({ value: t, label: t }))} />
        </Form.Item>
        <Form.Item label="Từ ngày - Đến ngày" name="range" rules={[{ required: true, message: 'Chọn khoảng ngày' }]}>
          <SlashRangePicker
            style={{ width: '100%' }}
            format="DD/MM/YYYY"
            onChange={(dates: any) => setDays(calcDays(dates?.[0] ?? null, dates?.[1] ?? null))}
          />
        </Form.Item>
        {days > 0 && <div style={{ marginTop: -12, marginBottom: 12, color: '#1677ff' }}>Số ngày nghỉ: {days} ngày</div>}
        <Form.Item label="Lý do" name="reason">
          <Input.TextArea rows={3} placeholder="Lý do xin nghỉ" maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
