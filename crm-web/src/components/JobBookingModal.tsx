'use client';

import { useEffect, useRef, useState } from 'react';
import { App, Form, Input, InputNumber, Modal, Select } from 'antd';
import { apiFetch } from '@/lib/api';
import { formatMoneyInput, parseMoneyInput } from '@/lib/numberFormat';
import { JOB_TYPES, TAX_RATES } from '@/lib/jobTypes';
import DescriptionAutocomplete from '@/components/DescriptionAutocomplete';

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

  const rate = Form.useWatch('taxRate', form);
  const isFivePercent = Number(rate ?? 0) === 5;

  // Chỉ thuế 5% mới tính ngược từ Tổng tiền (5/105): Tổng -> Trước thuế + Thuế
  // Các mức % khác chỉ tính xuôi: Trước thuế -> Tổng
  const lastEdit = useRef<'pretax' | 'total' | null>(null);
  useEffect(() => {
    if (!open) lastEdit.current = null;
  }, [open ]);

  function handleValuesChange(changed: Partial<JobBookingFormValues>, all: JobBookingFormValues) {
    const r = Number(all.taxRate ?? 0);
    const q = Number(all.quantity ?? 1) || 1;
    if ('total' in changed && r === 5) {
      lastEdit.current = 'total';
      const total = Number(changed.total ?? 0);
      const after = q > 0 ? total / q : total;
      const pre = Math.round((after / (1 + r / 100)) * 100) / 100;
      const tax = Math.round((after - pre) * 100) / 100;
      form.setFieldsValue({ pretaxAmount: pre, taxAmount: tax, afterTaxAmount: Math.round(after * 100) / 100 });
    } else if ('pretaxAmount' in changed || 'taxRate' in changed || 'quantity' in changed) {
      lastEdit.current = 'pretax';
      const p = Number(all.pretaxAmount ?? 0);
      const tax = (p * r) / 100;
      const after = p + tax;
      const total = after * q;
      const cur = form.getFieldsValue(['taxAmount', 'afterTaxAmount', 'total']);
      if (Math.abs(Number(cur.taxAmount ?? 0) - tax) > 0.005 || Math.abs(Number(cur.afterTaxAmount ?? 0) - after) > 0.005 || Math.abs(Number(cur.total ?? 0) - total) > 0.005) {
        form.setFieldsValue({ taxAmount: tax, afterTaxAmount: after, total });
      }
    }
  }

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
      <Form form={form} layout="vertical" onFinish={handleSubmit} onValuesChange={handleValuesChange} style={{ marginTop: 16 }}>
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
            <DescriptionAutocomplete type="booking" placeholder="Gõ để tìm mô tả đã từng nhập..." />
          </Form.Item>
          <Form.Item label="Đơn vị tính" name="unit">
            <Input placeholder="VD: Cont, Kg, Chuyến..." />
          </Form.Item>
          <Form.Item label="Số lượng" name="quantity">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Số lượng" formatter={(value: any) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} parser={parseMoneyInput} />
          </Form.Item>
          <Form.Item label="Trước thuế" name="pretaxAmount">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Số tiền trước thuế" formatter={(value: any) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} parser={parseMoneyInput} />
          </Form.Item>
          <Form.Item label="Thuế (%)" name="taxRate">
            <Select placeholder="Chọn thuế suất" options={TAX_RATES.map((t) => ({ value: t, label: `${t}%` }))} />
          </Form.Item>
          <Form.Item label="Tiền thuế" name="taxAmount">
            <InputNumber min={0} style={{ width: '100%' }} disabled formatter={(value: any) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} parser={parseMoneyInput} />
          </Form.Item>
          <Form.Item label="Sau thuế" name="afterTaxAmount">
            <InputNumber min={0} style={{ width: '100%' }} disabled formatter={(value: any) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} parser={parseMoneyInput} />
          </Form.Item>
          <Form.Item
            label={isFivePercent ? 'Tổng tiền (nhập để suy ngược Trước thuế + Thuế 5%)' : 'Tổng tiền'}
            name="total"
            className="sm:col-span-2"
          >
            <InputNumber
              min={0}
              style={{ width: '100%' }}
              disabled={!isFivePercent}
              placeholder={isFivePercent ? 'Nhập tổng để tự tính ngược' : 'Tự tính = (trước thuế + thuế) x SL'}
              formatter={(value: any) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} parser={parseMoneyInput}
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
