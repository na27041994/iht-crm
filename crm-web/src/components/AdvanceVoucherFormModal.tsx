'use client';

import { useEffect, useState } from 'react';
import { App, DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import dayjs from 'dayjs';
import { apiFetch } from '@/lib/api';
import { formatMoneyInput, parseMoneyInput } from '@/lib/numberFormat';
import { ADVANCE_TYPES } from '@/lib/advanceTypes';

interface SheetOption {
  id: number;
  sheetNumber: string;
  customerId?: number | null;
  customer: { id: number; companyName: string } | null;
  fromLocation?: string | null;
  toLocation?: string | null;
  containerQuantity?: string | number | null;
}

interface CustomerOption {
  id: number;
  customerName: string;
  companyName: string;
}

export interface AdvanceVoucherFormValues {
  sheetId?: number;
  type: string;
  advanceDate: string;
  currency: 'VND' | 'USD';
  customerId?: number;
  orderFrom?: string;
  orderTo?: string;
  containerQty?: number;
  qty?: number;
  note?: string;
}

interface AdvanceVoucherFormModalProps {
  open: boolean;
  editingId: number | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function AdvanceVoucherFormModal({
  open,
  editingId,
  onClose,
  onSaved,
}: AdvanceVoucherFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sheets, setSheets] = useState<SheetOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      apiFetch<{ items: SheetOption[] }>('/tracking-sheets?pageSize=100'),
      apiFetch<{ items: CustomerOption[] }>('/customers?pageSize=100'),
    ])
      .then(([sh, cs]) => {
        setSheets(sh.items);
        setCustomers(cs.items);
        form.resetFields();
        form.setFieldsValue({ currency: 'VND', advanceDate: dayjs(), type: 'Chi tạm ứng' });
        if (editingId) {
          return apiFetch<
            AdvanceVoucherFormValues & {
              id: number;
              advanceNo: string;
              advanceDate: string;
            }
          >(`/advance-vouchers/${editingId}`).then((v) => {
            form.setFieldsValue({
              sheetId: v.sheetId ?? undefined,
              type: v.type,
              advanceDate: v.advanceDate ? dayjs(v.advanceDate) : dayjs(),
              currency: v.currency as 'VND' | 'USD',
              customerId: v.customerId ?? undefined,
              orderFrom: v.orderFrom ?? '',
              orderTo: v.orderTo ?? '',
              containerQty: v.containerQty ?? undefined,
              qty: v.qty == null ? undefined : Number(v.qty),
              note: v.note ?? '',
            });
          });
        }
        return Promise.resolve();
      })
      .catch((err) => message.error(err instanceof Error ? err.message : 'Không tải được dữ liệu'))
      .finally(() => setLoading(false));
  }, [open, editingId, form, message]);

  // Hàm handleSubmit: xử lý handleSubmit
  async function handleSubmit(values: AdvanceVoucherFormValues) {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        sheetId: values.sheetId ?? null,
        type: values.type,
        advanceDate: dayjs(values.advanceDate).format('YYYY-MM-DD'),
        currency: values.currency,
        customerId: values.customerId ?? null,
        orderFrom: values.orderFrom && String(values.orderFrom).trim() !== '' ? String(values.orderFrom).trim() : null,
        orderTo: values.orderTo && String(values.orderTo).trim() !== '' ? String(values.orderTo).trim() : null,
        containerQty: values.containerQty ?? null,
        qty: values.qty ?? null,
        note: values.note && String(values.note).trim() !== '' ? String(values.note).trim() : null,
      };
      if (editingId) {
        await apiFetch(`/advance-vouchers/${editingId}`, { method: 'PUT', body: JSON.stringify(body) });
        message.success('Đã cập nhật phiếu chi tạm ứng');
      } else {
        await apiFetch('/advance-vouchers', { method: 'POST', body: JSON.stringify(body) });
        message.success('Đã tạo phiếu chi tạm ứng');
      }
      onSaved();
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  const watchedSheetId = Form.useWatch('sheetId', form);
  const watchedType = Form.useWatch('type', form);
  const selectedSheet = sheets.find((s) => s.id === watchedSheetId);
  const isChiTamUng = (watchedType ?? form.getFieldValue('type') ?? '') === 'Chi tạm ứng';

  // Chọn Job -> lấy thông tin job qua (khách hàng, tuyến, số cont)
  async function handleSheetChange(sheetId?: number) {
    if (!sheetId) return;
    try {
      const detail = await apiFetch<{
        customerId?: number | null;
        customer?: { id: number; companyName: string } | null;
        fromLocation?: string | null;
        toLocation?: string | null;
        containerQuantity?: string | number | null;
      }>(`/tracking-sheets/${sheetId}`);
      form.setFieldsValue({
        customerId: detail.customerId ?? detail.customer?.id ?? undefined,
        orderFrom: detail.fromLocation ?? '',
        orderTo: detail.toLocation ?? '',
        containerQty: detail.containerQuantity != null && String(detail.containerQuantity).trim() !== '' && !Number.isNaN(Number(detail.containerQuantity)) ? Number(detail.containerQuantity) : undefined,
      });
      // đồng bộ list sheets để hint khách hàng đúng
      setSheets((prev) => prev.map((s) => (s.id === sheetId ? { ...s, customerId: detail.customerId ?? s.customerId, fromLocation: detail.fromLocation ?? s.fromLocation, toLocation: detail.toLocation ?? s.toLocation, containerQuantity: detail.containerQuantity ?? s.containerQuantity } : s)));
    } catch {
      // ignore, user vẫn nhập tay được
    }
  }

  return (
    <Modal
      open={open}
      title={editingId ? 'Sửa phiếu chi tạm ứng' : 'Tạo phiếu chi tạm ứng'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editingId ? 'Lưu thay đổi' : 'Tạo phiếu'}
      confirmLoading={saving}
      width={720}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item
            label="Chọn Job"
            name="sheetId"
            rules={isChiTamUng ? [{ required: true, message: 'Chi tạm ứng bắt buộc phải chọn Job' }] : undefined}
          >
            <Select
              placeholder={isChiTamUng ? 'Bắt buộc chọn Job cho Chi tạm ứng' : 'Chọn phiếu theo dõi'}
              showSearch
              optionFilterProp="label"
              onChange={(v) => handleSheetChange(v)}
              options={sheets.map((s) => ({
                value: s.id,
                label: `${s.sheetNumber}${s.customer ? ` - ${s.customer.companyName}` : ''}`,
              }))}
            />
          </Form.Item>
          <Form.Item label="Loại" name="type" rules={[{ required: true, message: 'Chọn loại' }]}>
            <Select options={ADVANCE_TYPES.map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item label="Advance No (tự sinh)">
            <Input value={`${dayjs().format('YYMMDD')}xxx`} disabled />
          </Form.Item>
          <Form.Item label="Ngày tạo" name="advanceDate" rules={[{ required: true, message: 'Chọn ngày' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item label="Current" name="currency">
            <Select options={[{ value: 'VND', label: 'VND' }, { value: 'USD', label: 'USD' }]} />
          </Form.Item>
          <Form.Item label="Chọn khách hàng" name="customerId">
            <Select
              placeholder="Chọn khách hàng"
              showSearch
              optionFilterProp="label"
              options={customers.map((c) => ({
                value: c.id,
                label: c.companyName || c.customerName,
              }))}
            />
          </Form.Item>
          <Form.Item label="Order From" name="orderFrom">
            <Input placeholder="Điểm đi" />
          </Form.Item>
          <Form.Item label="Order To" name="orderTo">
            <Input placeholder="Điểm đến" />
          </Form.Item>
          <Form.Item label="Container Qty" name="containerQty">
            <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="Số container" />
          </Form.Item>
          <Form.Item label="Qty" name="qty">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Số lượng" formatter={(value: any) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} parser={parseMoneyInput} />
          </Form.Item>
          <Form.Item label="Ghi chú" name="note" className="sm:col-span-2">
            <Input.TextArea rows={3} placeholder="Ghi chú thêm" />
          </Form.Item>
        </div>
        {selectedSheet?.customer && (
          <div style={{ fontSize: 13, color: '#999', marginTop: -8 }}>
            Khách hàng của Job: {selectedSheet.customer.companyName}
          </div>
        )}
      </Form>
    </Modal>
  );
}