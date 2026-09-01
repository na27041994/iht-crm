'use client';

import { useEffect, useState } from 'react';
import { App, Form, Input, Modal } from 'antd';
import { apiFetch } from '@/lib/api';

export interface TruckerFormValues {
  truckerName: string;
  companyName: string;
  contactPerson?: string;
  taxCode?: string;
  phone?: string;
  fax?: string;
  address?: string;
  note?: string;
}

interface TruckerFormModalProps {
  open: boolean;
  editingId: number | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function TruckerFormModal({ open, editingId, onClose, onSaved }: TruckerFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editingId) {
      setLoading(true);
      apiFetch<TruckerFormValues & { id: number }>(`/truckers/${editingId}`)
        .then((c) => {
          form.setFieldsValue({
            truckerName: c.truckerName,
            companyName: c.companyName,
            contactPerson: c.contactPerson ?? '',
            taxCode: c.taxCode ?? '',
            phone: c.phone ?? '',
            fax: c.fax ?? '',
            address: c.address ?? '',
            note: c.note ?? '',
          });
        })
        .catch((err) => message.error(err instanceof Error ? err.message : 'Không tải được nhà xe'))
        .finally(() => setLoading(false));
    }
  }, [open, editingId, form, message]);

  // Hàm handleSubmit: xử lý handleSubmit
  async function handleSubmit(values: TruckerFormValues) {
    setSaving(true);
    try {
      const body: Record<string, string | null> = {};
      Object.entries(values).forEach(([k, v]) => {
        body[k] = v == null || String(v).trim() === '' ? null : String(v).trim();
      });

      if (editingId) {
        await apiFetch(`/truckers/${editingId}`, { method: 'PUT', body: JSON.stringify(body) });
        message.success('Đã cập nhật nhà xe');
      } else {
        await apiFetch('/truckers', { method: 'POST', body: JSON.stringify(body) });
        message.success('Đã thêm nhà xe');
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
      title={editingId ? 'Sửa nhà xe' : 'Thêm nhà xe'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editingId ? 'Lưu thay đổi' : 'Thêm nhà xe'}
      confirmLoading={saving}
      width={680}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item
            label="Tên nhà xe"
            name="truckerName"
            rules={[{ required: true, min: 2, message: 'Tối thiểu 2 ký tự' }]}
          >
            <Input placeholder="VD: Nhà xe Hải Vận" />
          </Form.Item>
          <Form.Item
            label="Tên đơn vị"
            name="companyName"
            rules={[{ required: true, min: 2, message: 'Tối thiểu 2 ký tự' }]}
          >
            <Input placeholder="Công ty TNHH Vận tải Hải Vận" />
          </Form.Item>
          <Form.Item label="Người liên hệ" name="contactPerson">
            <Input placeholder="Nguyễn Văn A" />
          </Form.Item>
          <Form.Item label="Điện thoại" name="phone">
            <Input placeholder="028 7777 1234" />
          </Form.Item>
          <Form.Item label="Số fax" name="fax">
            <Input placeholder="028 7777 1235" />
          </Form.Item>
          <Form.Item label="Mã số thuế" name="taxCode">
            <Input placeholder="0312345678" />
          </Form.Item>
          <Form.Item label="Địa chỉ" name="address" className="sm:col-span-2">
            <Input placeholder="Số nhà, đường, quận/huyện, tỉnh/thành" />
          </Form.Item>
          <Form.Item label="Ghi chú" name="note" className="sm:col-span-2">
            <Input.TextArea rows={3} placeholder="Ghi chú thêm về nhà xe" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}