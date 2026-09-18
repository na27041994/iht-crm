'use client';

import { useEffect, useState } from 'react';
import { App, Form, Input, Modal, Select } from 'antd';
import { apiFetch } from '@/lib/api';

export const CUSTOMER_TYPES = ['KH', 'DL'] as const;

export interface CustomerFormValues {
  customerType: string;
  customerName: string;
  companyName: string;
  contactPerson?: string;
  taxCode?: string;
  phone?: string;
  fax?: string;
  email?: string;
  address?: string;
  country?: string;
  note?: string;
}

interface CustomerFormModalProps {
  open: boolean;
  editingId: number | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function CustomerFormModal({ open, editingId, onClose, onSaved }: CustomerFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentCode, setCurrentCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ customerType: 'KH' });
    setCurrentCode(null);
    if (editingId) {
      setLoading(true);
      apiFetch<CustomerFormValues & { id: number; code?: string | null }>(`/customers/${editingId}`)
        .then((c) => {
          setCurrentCode((c as any).code ?? null);
          form.setFieldsValue({
            customerType: (c as any).customerType ?? 'KH',
            customerName: c.customerName,
            companyName: c.companyName,
            contactPerson: c.contactPerson ?? '',
            taxCode: c.taxCode ?? '',
            phone: c.phone ?? '',
            fax: c.fax ?? '',
            email: c.email ?? '',
            address: c.address ?? '',
            country: c.country ?? '',
            note: c.note ?? '',
          });
        })
        .catch((err) => message.error(err instanceof Error ? err.message : 'Không tải được khách hàng'))
        .finally(() => setLoading(false));
    }
  }, [open, editingId, form, message]);

  // Hàm handleSubmit: xử lý handleSubmit
  async function handleSubmit(values: CustomerFormValues) {
    setSaving(true);
    try {
      const body: Record<string, string | null> = {};
      Object.entries(values).forEach(([k, v]) => {
        body[k] = v == null || String(v).trim() === '' ? null : String(v).trim();
      });

      if (editingId) {
        await apiFetch(`/customers/${editingId}`, { method: 'PUT', body: JSON.stringify(body) });
        message.success('Đã cập nhật khách hàng');
      } else {
        await apiFetch('/customers', { method: 'POST', body: JSON.stringify(body) });
        message.success('Đã thêm khách hàng');
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
      title={editingId ? 'Sửa khách hàng' : 'Thêm khách hàng'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editingId ? 'Lưu thay đổi' : 'Thêm khách hàng'}
      confirmLoading={saving}
      width={680}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item label="Phân loại" name="customerType" rules={[{ required: true, message: 'Chọn phân loại' }]}>
            <Select options={CUSTOMER_TYPES.map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item label="Mã khách hàng">
            <Input value={currentCode ?? '(tự sinh khi lưu)'} disabled />
          </Form.Item>
          <Form.Item
            label="Tên khách hàng"
            name="customerName"
            rules={[{ required: true, min: 2, message: 'Tối thiểu 2 ký tự' }]}
          >
            <Input placeholder="VD: Công ty vận tải Hải An" />
          </Form.Item>
          <Form.Item
            label="Tên đơn vị"
            name="companyName"
            rules={[{ required: true, min: 2, message: 'Tối thiểu 2 ký tự' }]}
          >
            <Input placeholder="Công ty TNHH Hải An" />
          </Form.Item>
          <Form.Item label="Người liên hệ" name="contactPerson">
            <Input placeholder="Nguyễn Văn A" />
          </Form.Item>
          <Form.Item label="Điện thoại" name="phone">
            <Input placeholder="090 123 4567" />
          </Form.Item>
          <Form.Item label="Số fax" name="fax">
            <Input placeholder="028 3822 1234" />
          </Form.Item>
          <Form.Item
            label="Email"
            name="email"
            rules={[{ type: 'email', message: 'Email không hợp lệ' }]}
          >
            <Input placeholder="info@hai-an.com" />
          </Form.Item>
          <Form.Item label="Mã số thuế" name="taxCode">
            <Input placeholder="0312345678" />
          </Form.Item>
          <Form.Item label="Quốc gia" name="country">
            <Input placeholder="Việt Nam" />
          </Form.Item>
          <Form.Item label="Địa chỉ" name="address" className="sm:col-span-2">
            <Input placeholder="Số nhà, đường, quận/huyện, tỉnh/thành" />
          </Form.Item>
          <Form.Item label="Ghi chú" name="note" className="sm:col-span-2">
            <Input.TextArea rows={3} placeholder="Ghi chú thêm về khách hàng" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}