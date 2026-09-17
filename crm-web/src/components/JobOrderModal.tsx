'use client';

import { useEffect, useRef, useState } from 'react';
import { App, Form, Input, InputNumber, Modal, Select } from 'antd';
import { apiFetch } from '@/lib/api';
import { formatMoneyInput, parseMoneyInput } from '@/lib/numberFormat';
import { JOB_TYPES, TAX_RATES } from '@/lib/jobTypes';
import DescriptionAutocomplete from '@/components/DescriptionAutocomplete';

export interface JobOrderItem {
  id: number;
  type: string;
  description: string | null;
  portAmt: string | null;
  pretaxAmount: string | null;
  taxRate: string | null;
  deliveryStaffId: number | null;
  deliveryStaff?: { id: number; fullName: string } | null;
  industry: string | null;
  note: string | null;
}

export interface JobOrderFormValues {
  type: string;
  description?: string;
  portAmt?: number;
  pretaxAmount?: number;
  taxRate?: number;
  deliveryStaffId?: number;
  note?: string;
}

interface JobOrderModalProps {
  open: boolean;
  sheetId: number;
  editing: JobOrderItem | null;
  onClose: () => void;
  onSaved: () => void;
}

interface UserOption {
  id: number;
  fullName: string;
}

export default function JobOrderModal({ open, sheetId, editing, onClose, onSaved }: JobOrderModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);

  useEffect(() => {
    if (!open) return;
    apiFetch<UserOption[]>('/auth/users').then(setUsers).catch(() => setUsers([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editing) {
      form.setFieldsValue({
        type: editing.type,
        description: editing.description ?? '',
        portAmt: editing.portAmt == null ? undefined : Number(editing.portAmt) / 100,
        pretaxAmount: (editing as any).pretaxAmount == null ? undefined : Number((editing as any).pretaxAmount) / 100,
        taxRate: (editing as any).taxRate == null ? 0 : Number((editing as any).taxRate),
        deliveryStaffId: (editing as any).deliveryStaffId ?? (editing as any).deliveryStaff?.id ?? undefined,
        note: editing.note ?? '',
      });
    } else {
      form.setFieldsValue({ taxRate: 0 });
    }
  }, [open, editing, form]);

  // Tính 2 chiều, nhớ ô giá nhập cuối để đổi thuế không ghi đè sai:
  // - nhập Trước thuế -> Port = trước*(1+thuế)
  // - nhập Port (sau thuế) -> Trước = port/(1+thuế)
  // - đổi Thuế: giữ nguyên ô nhập cuối, tính lại ô còn lại
  const lastPriceEdit = useRef<'pretax' | 'port' | null>(null);

  useEffect(() => {
    if (!open) lastPriceEdit.current = null;
  }, [open ]);

  function handleValuesChange(changed: Partial<JobOrderFormValues>, all: JobOrderFormValues) {
    const r = Number(all.taxRate ?? 0);
    const factor = 1 + r / 100;
    if ('pretaxAmount' in changed) {
      lastPriceEdit.current = 'pretax';
      const p = Number(changed.pretaxAmount ?? 0);
      const total = Math.round(p * factor * 100) / 100;
      if (Math.abs(total - Number(all.portAmt ?? 0)) > 0.005) {
        form.setFieldsValue({ portAmt: total });
      }
    } else if ('portAmt' in changed) {
      lastPriceEdit.current = 'port';
      const port = Number(changed.portAmt ?? 0);
      const pre = factor > 0 ? Math.round((port / factor) * 100) / 100 : port;
      if (Math.abs(pre - Number(all.pretaxAmount ?? 0)) > 0.005) {
        form.setFieldsValue({ pretaxAmount: pre });
      }
    } else if ('taxRate' in changed) {
      // đổi thuế: giữ ô nhập cuối, tính lại ô kia
      if (lastPriceEdit.current === 'port') {
        const port = Number(all.portAmt ?? 0);
        const pre = factor > 0 ? Math.round((port / factor) * 100) / 100 : port;
        if (Math.abs(pre - Number(all.pretaxAmount ?? 0)) > 0.005) {
          form.setFieldsValue({ pretaxAmount: pre });
        }
      } else {
        const p = Number(all.pretaxAmount ?? 0);
        const total = Math.round(p * factor * 100) / 100;
        if (Math.abs(total - Number(all.portAmt ?? 0)) > 0.005) {
          form.setFieldsValue({ portAmt: total });
        }
      }
    }
  }

  async function handleSubmit(values: JobOrderFormValues) {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        type: values.type,
        description: values.description && String(values.description).trim() !== '' ? String(values.description).trim() : null,
        portAmt: values.portAmt ?? null,
        pretaxAmount: values.pretaxAmount ?? null,
        taxRate: values.taxRate ?? null,
        deliveryStaffId: values.deliveryStaffId ?? null,
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
      <Form form={form} layout="vertical" onFinish={handleSubmit} onValuesChange={handleValuesChange} style={{ marginTop: 16 }}>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item
            label="Phân loại"
            name="type"
            rules={[{ required: true, message: 'Chọn phân loại' }]}
            className="sm:col-span-2"
          >
            <Select placeholder="Chọn phân loại" options={JOB_TYPES.map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item label="Mô tả" name="description" className="sm:col-span-2">
            <DescriptionAutocomplete type="order" placeholder="Gõ để tìm mô tả đã từng nhập..." />
          </Form.Item>
          <Form.Item label="Nhân viên giao nhận" name="deliveryStaffId" className="sm:col-span-2">
            <Select
              placeholder="Chọn nhân viên giao nhận"
              showSearch
              optionFilterProp="label"
              allowClear
              options={users.map((u) => ({ value: u.id, label: u.fullName }))}
            />
          </Form.Item>
          <Form.Item label="Trước thuế" name="pretaxAmount">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Số tiền trước thuế" formatter={(value: any) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} parser={parseMoneyInput} />
          </Form.Item>
          <Form.Item label="Thuế (%)" name="taxRate">
            <Select placeholder="Chọn thuế suất" options={TAX_RATES.map((t) => ({ value: t, label: `${t}%` }))} />
          </Form.Item>
          <Form.Item label="Port Amt (sau thuế, nhập để suy ngược trước thuế)" name="portAmt" className="sm:col-span-2">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Nhập sau thuế để tự tính ngược, hoặc để trống tự tính" formatter={(value: any) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} parser={parseMoneyInput} />
          </Form.Item>
          <Form.Item label="Ghi chú" name="note" className="sm:col-span-2">
            <Input.TextArea rows={3} placeholder="Ghi chú" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
