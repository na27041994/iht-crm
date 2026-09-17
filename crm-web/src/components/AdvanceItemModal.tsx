'use client';

import { useEffect, useState } from 'react';
import { App, Checkbox, Form, Input, InputNumber, Modal, Select } from 'antd';
import { apiFetch } from '@/lib/api';
import { formatMoneyInput, parseMoneyInput } from '@/lib/numberFormat';
import { usePermissions } from '@/hooks/usePermission';
import DescriptionAutocomplete from '@/components/DescriptionAutocomplete';

export const ADVANCE_ITEM_KINDS = ['Chi', 'Giảm trừ'] as const;

export interface AdvanceItem {
  id: number;
  amount: string;
  kind?: string | null;
  description?: string | null;
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
  const [createJobOrder, setCreateJobOrder] = useState(false);
  const [voucherInfo, setVoucherInfo] = useState<{ type: string; sheetId?: number | null } | null>(null);
  const { can } = usePermissions();
  const canCreateJobOrder = can('job_order', 'create');

  const kind = Form.useWatch('kind', form);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ kind: 'Chi' });
    setCreateJobOrder(false);
    // lấy loại phiếu + job để quyết định hiện checkbox
    apiFetch<{ type: string; sheetId?: number | null }>(`/advance-vouchers/${voucherId}`)
      .then((v) => setVoucherInfo({ type: v.type, sheetId: v.sheetId }))
      .catch(() => setVoucherInfo(null));
    if (editing) {
      // DB lưu *100, hiển thị chia 100, amount luôn dương
      form.setFieldsValue({ amount: Number(editing.amount) / 100, kind: (editing as any).kind ?? 'Chi', description: (editing as any).description ?? '', note: editing.note ?? '' });
    }
  }, [open, editing, form, voucherId]);

  const showJobCheckbox = !editing && (kind ?? 'Chi') === 'Chi' && voucherInfo?.type === 'Chi tạm ứng' && voucherInfo?.sheetId != null && canCreateJobOrder;

  async function handleSubmit(values: { amount: number; kind: string; description?: string; note?: string }) {
    if (values.amount == null || Number(values.amount) <= 0) {
      message.error('Số tiền phải > 0');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        amount: values.amount,
        kind: values.kind ?? 'Chi',
        description: values.description && String(values.description).trim() !== '' ? String(values.description).trim() : null,
        note: values.note && String(values.note).trim() !== '' ? String(values.note).trim() : null,
      };
      if (showJobCheckbox && createJobOrder) (body as any).createJobOrder = true;
      if (editing) {
        await apiFetch(`/advance-vouchers/${voucherId}/items/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
        message.success('Đã cập nhật khoản chi');
      } else {
        await apiFetch(`/advance-vouchers/${voucherId}/items`, { method: 'POST', body: JSON.stringify(body) });
        message.success(showJobCheckbox && createJobOrder ? 'Đã thêm khoản chi + tạo Job Order' : 'Đã thêm khoản chi');
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
        <Form.Item label="Loại khoản" name="kind" rules={[{ required: true, message: 'Chọn loại khoản' }]}>
          <Select options={ADVANCE_ITEM_KINDS.map((k) => ({ value: k, label: k === 'Giảm trừ' ? 'Giảm trừ (trừ vào tổng)' : 'Chi' }))} />
        </Form.Item>
        <Form.Item label="Tiền (luôn nhập dương)" name="amount" rules={[{ required: true, message: 'Nhập số tiền' }]}>
          <InputNumber min={0} style={{ width: '100%' }} placeholder="Số tiền chi" formatter={formatMoneyInput} parser={parseMoneyInput} />
        </Form.Item>
        <Form.Item label="Mô tả" name="description">
          <DescriptionAutocomplete type="advance" placeholder="Gõ để tìm mô tả đã từng nhập..." />
        </Form.Item>
        <Form.Item label="Ghi chú" name="note">
          <Input placeholder="Ghi chú khoản chi" />
        </Form.Item>
        {showJobCheckbox && (
          <Form.Item>
            <Checkbox checked={createJobOrder} onChange={(e) => setCreateJobOrder(e.target.checked)}>
              Đồng thời tạo <strong>Job Order (Our Company Pay)</strong>
            </Checkbox>
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
