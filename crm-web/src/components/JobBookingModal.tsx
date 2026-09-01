'use client';

import { useEffect, useState } from 'react';
import { App, Form, Input, InputNumber, Modal, Select } from 'antd';
import { apiFetch } from '@/lib/api';
import { JOB_TYPES, TAX_RATES } from '@/lib/jobTypes';

export interface JobBookingItem {
  id: number;
  type: string;
  description: string | null;
  unit: string | null;
  quantity: string | null;
  pretaxAmount: string | null;
  taxRate: string | null;
  taxAmount: string | null;
  afterTaxAmount: string | null;
  total: string | null;
}

export interface JobBookingFormValues {
  type: string;
  description?: string;
  unit?: string;
  quantity?: number;
  pretaxAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  afterTaxAmount?: number;
  total?: number;
}

interface JobBookingModalProps {
  open: boolean;
  sheetId: number;
  editing: JobBookingItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function JobBookingModal({ open, sheetId, editing, onClose, onSaved }: JobBookingModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editing) {
      // DB lưu *100, hiển thị chia 100
      form.setFieldsValue({
        type: editing.type,
        description: editing.description ?? '',
        unit: editing.unit ?? '',
        quantity: editing.quantity == null ? undefined : Number(editing.quantity),
        pretaxAmount: editing.pretaxAmount == null ? undefined : Number(editing.pretaxAmount) / 100,
        taxRate: editing.taxRate == null ? 0 : Number(editing.taxRate),
        taxAmount: editing.taxAmount == null ? undefined : Number(editing.taxAmount) / 100,
        afterTaxAmount: editing.afterTaxAmount == null ? undefined : Number(editing.afterTaxAmount) / 100,
        total: editing.total == null ? undefined : Number(editing.total) / 100,
      });
    }
  }, [open, editing, form]);

  const pretax = Form.useWatch('pretaxAmount', form);
  const rate = Form.useWatch('taxRate', form);
  const quantity = Form.useWatch('quantity', form);

  useEffect(() => {
    if (!open) return;
    const p = Number(pretax ?? 0);
    const r = Number(rate ?? 0);
    const q = Number(quantity ?? 1);
    const tax = (p * r) / 100;
    const after = p + tax;
    const total = after * q;
    form.setFieldsValue({
      taxAmount: tax,
      afterTaxAmount: after,
      total,
    });
  }, [open, pretax, rate, quantity, form]);

  // Hàm handleSubmit: xử lý handleSubmit
  async function handleSubmit(values: JobBookingFormValues) {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        type: values.type,
        description: values.description && String(values.description).trim() !== '' ? String(values.description).trim() : null,
        unit: values.unit && String(values.unit).trim() !== '' ? String(values.unit).trim() : null,
        quantity: values.quantity ?? null,
        pretaxAmount: values.pretaxAmount ?? null,
        taxRate: values.taxRate ?? null,
        taxAmount: values.taxAmount ?? null,
        afterTaxAmount: values.afterTaxAmount ?? null,
        total: values.total ?? null,
      };
      if (editing) {
        await apiFetch(`/tracking-sheets/${sheetId}/job-bookings/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
        message.success('Đã cập nhật mục Job Book');
      } else {
        await apiFetch(`/tracking-sheets/${sheetId}/job-bookings`, { method: 'POST', body: JSON.stringify(body) });
        message.success('Đã thêm mục Job Book');
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
      title={editing ? 'Sửa Job Book' : 'Thêm Job Book'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editing ? 'Lưu thay đổi' : 'Thêm mục'}
      confirmLoading={saving}
      width={720}
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
          <Form.Item label="Đơn vị tính" name="unit">
            <Input placeholder="VD: Cont, Kg, Chuyến..." />
          </Form.Item>
          <Form.Item label="Số lượng" name="quantity">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Số lượng" />
          </Form.Item>
          <Form.Item label="Trước thuế" name="pretaxAmount">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Số tiền trước thuế" />
          </Form.Item>
          <Form.Item label="Thuế (%)" name="taxRate">
            <Select placeholder="Chọn thuế suất" options={TAX_RATES.map((t) => ({ value: t, label: `${t}%` }))} />
          </Form.Item>
          <Form.Item label="Tiền thuế" name="taxAmount">
            <InputNumber min={0} style={{ width: '100%' }} disabled />
          </Form.Item>
          <Form.Item label="Sau thuế" name="afterTaxAmount">
            <InputNumber min={0} style={{ width: '100%' }} disabled />
          </Form.Item>
          <Form.Item label="Tổng tiền" name="total" className="sm:col-span-2">
            <InputNumber min={0} style={{ width: '100%' }} disabled />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
