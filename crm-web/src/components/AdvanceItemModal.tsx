'use client';

import { useEffect, useState } from 'react';
import { App, Form, Input, InputNumber, Modal } from 'antd';
import { apiFetch } from '@/lib/api';
import { formatMoneyInput, parseMoneyInput } from '@/lib/numberFormat';

export interface AdvanceItem {
  id: number;
  amount: string;
  note: string | null;
}

interface AdvanceItemModalProps {
  open: boolean;
  voucherId: number;
  editing: AdvanceItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function AdvanceItemModal({ open, voucherId, editing, onClose, onSaved }: AdvanceItemModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editing) {
      // DB lưu *100, hiển thị chia 100
      form.setFieldsValue({ amount: Number(editing.amount) / 100, note: editing.note ?? '' });
    }
  }, [open, editing, form]);

  // Hàm handleSubmit: xử lý handleSubmit
  async function handleSubmit(values: { amount: number; note?: string }) {
    setSaving(true);
    try {
      const body = {
        amount: values.amount,
        note: values.note && String(values.note).trim() !== '' ? String(values.note).trim() : null,
      };
      if (editing) {
        await apiFetch(`/advance-vouchers/${voucherId}/items/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
        message.success('Đã cập nhật khoản chi');
      } else {
        await apiFetch(`/advance-vouchers/${voucherId}/items`, { method: 'POST', body: JSON.stringify(body) });
        message.success('Đã thêm khoản chi');
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
      title={editing ? 'Sửa khoản chi' : 'Thêm khoản chi'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editing ? 'Lưu thay đổi' : 'Thêm'}
      confirmLoading={saving}
      width={480}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
        <Form.Item label="Tiền" name="amount" rules={[{ required: true, message: 'Nhập số tiền' }]}>
          <InputNumber min={0} style={{ width: '100%' }} placeholder="Số tiền chi" formatter={(value: any) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} parser={parseMoneyInput} />
        </Form.Item>
        <Form.Item label="Ghi chú" name="note">
          <Input placeholder="Ghi chú khoản chi" />
        </Form.Item>
      </Form>
    </Modal>
  );
}