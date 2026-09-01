'use client';

import { useEffect, useState } from 'react';
import { App, Form, Input, InputNumber, Modal, Select } from 'antd';
import { apiFetch } from '@/lib/api';
import { JOB_TYPES } from '@/lib/jobTypes';

export interface JobOrderItem {
  id: number;
  type: string;
  description: string | null;
  portAmt: string | null;
  industry: string | null;
  note: string | null;
}

export interface JobOrderFormValues {
  type: string;
  description?: string;
  portAmt?: number;
  industry?: string;
  note?: string;
}

interface JobOrderModalProps {
  open: boolean;
  sheetId: number;
  editing: JobOrderItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function JobOrderModal({ open, sheetId, editing, onClose, onSaved }: JobOrderModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editing) {
      form.setFieldsValue({
        type: editing.type,
        description: editing.description ?? '',
        portAmt: editing.portAmt == null ? undefined : Number(editing.portAmt) / 100,
        industry: editing.industry ?? '',
        note: editing.note ?? '',
      });
    }
  }, [open, editing, form]);

  // Hàm handleSubmit: xử lý handleSubmit
  async function handleSubmit(values: JobOrderFormValues) {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        type: values.type,
        description: values.description && String(values.description).trim() !== '' ? String(values.description).trim() : null,
        portAmt: values.portAmt ?? null,
        industry: values.industry && String(values.industry).trim() !== '' ? String(values.industry).trim() : null,
        note: values.note && String(values.note).trim() !== '' ? String(values.note).trim() : null,
      };
      if (editing) {
        await apiFetch(`/tracking-sheets/${sheetId}/job-orders/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
        message.success('Đã cập nhật mục Job Order');
      } else {
        await apiFetch(`/tracking-sheets/${sheetId}/job-orders`, { method: 'POST', body: JSON.stringify(body) });
        message.success('Đã thêm mục Job Order');
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
      title={editing ? 'Sửa Job Order' : 'Thêm Job Order'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editing ? 'Lưu thay đổi' : 'Thêm mục'}
      confirmLoading={saving}
      width={640}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item
            label="Loại"
            name="type"
            rules={[{ required: true, message: 'Chọn loại' }]}
            className="sm:col-span-2"
          >
            <Select placeholder="Chọn loại" options={JOB_TYPES.map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item label="Mô tả" name="description" className="sm:col-span-2">
            <Input placeholder="Mô tả nội dung" />
          </Form.Item>
          <Form.Item label="Port Amt" name="portAmt">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Số tiền" />
          </Form.Item>
          <Form.Item label="Industry" name="industry">
            <Input placeholder="Ngành hàng" />
          </Form.Item>
          <Form.Item label="Ghi chú" name="note" className="sm:col-span-2">
            <Input.TextArea rows={3} placeholder="Ghi chú" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
