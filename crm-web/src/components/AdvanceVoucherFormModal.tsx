'use client';

import { useEffect, useRef, useState } from 'react';
import { App, Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Spin } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
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
  const [items, setItems] = useState<Array<{ amount?: number; note?: string }>>([]);
  const [fetchingSheets, setFetchingSheets] = useState(false);
  const [fetchingCustomers, setFetchingCustomers] = useState(false);
  const sheetSearchTimeout = useRef<NodeJS.Timeout | null>(null);
  const customerSearchTimeout = useRef<NodeJS.Timeout | null>(null);

  async function fetchSheets(search: string) {
    setFetchingSheets(true);
    try {
      const params = new URLSearchParams({ pageSize: '50' });
      if (search) params.set('search', search);
      const res = await apiFetch<{ items: SheetOption[] }>(`/tracking-sheets?${params}`);
      setSheets(res.items);
    } catch {
      // ignore
    } finally {
      setFetchingSheets(false);
    }
  }
  function handleSheetSearch(value: string) {
    if (sheetSearchTimeout.current) clearTimeout(sheetSearchTimeout.current);
    sheetSearchTimeout.current = setTimeout(() => fetchSheets(value), 300);
  }
  async function fetchCustomers(search: string) {
    setFetchingCustomers(true);
    try {
      const params = new URLSearchParams({ pageSize: '50' });
      if (search) params.set('search', search);
      const res = await apiFetch<{ items: CustomerOption[] }>(`/customers?${params}`);
      setCustomers(res.items);
    } catch {
      // ignore
    } finally {
      setFetchingCustomers(false);
    }
  }
  function handleCustomerSearch(value: string) {
    if (customerSearchTimeout.current) clearTimeout(customerSearchTimeout.current);
    customerSearchTimeout.current = setTimeout(() => fetchCustomers(value), 300);
  }
  // Đảm bảo option đã chọn luôn có trong list để hiện tên thay vì ID
  async function ensureCustomerOption(customerId?: number | null) {
    if (customerId == null) return;
    setCustomers((prev) => {
      if (prev.some((c) => c.id === customerId)) return prev;
      // fetch riêng khách này rồi append
      apiFetch<CustomerOption>(`/customers/${customerId}`)
        .then((c) => setCustomers((p) => (p.some((x) => x.id === c.id) ? p : [...p, c])))
        .catch(() => {});
      return prev;
    });
  }

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
        setItems([]);
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
            // nạp option cho job/khách đã lưu để hiện tên
            if (v.sheetId) {
              apiFetch<SheetOption>(`/tracking-sheets/${v.sheetId}`).then((s: any) => {
                setSheets((prev) => (prev.some((x) => x.id === s.id) ? prev : [...prev, { id: s.id, sheetNumber: s.sheetNumber, customerId: s.customerId, customer: s.customer, fromLocation: s.fromLocation, toLocation: s.toLocation, containerQuantity: s.containerQuantity }]));
              }).catch(() => {});
            }
            ensureCustomerOption(v.customerId);
          });
        }
        return Promise.resolve();
      })
      .catch((err) => message.error(err instanceof Error ? err.message : 'Không tải được dữ liệu'))
      .finally(() => setLoading(false));
  }, [open, editingId, form, message]);

  function addItem() {
    setItems((prev) => [...prev, { amount: undefined, note: '' }]);
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateItem(idx: number, patch: Partial<{ amount?: number; note?: string }>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  const itemsTotal = items.reduce((s, it) => s + Number(it.amount ?? 0), 0);

  // Hàm handleSubmit: xử lý handleSubmit (tạo phiếu + gộp các khoản chi luôn)
  async function handleSubmit(values: AdvanceVoucherFormValues) {
    // validate khoản chi khi tạo mới
    if (!editingId && items.some((it) => it.amount == null || Number(it.amount) <= 0)) {
      message.error('Mỗi khoản chi phải nhập số tiền > 0');
      return;
    }
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
        const created = await apiFetch<{ id: number }>(`/advance-vouchers`, { method: 'POST', body: JSON.stringify(body) });
        // gộp các khoản chi ngay khi tạo phiếu
        for (const it of items) {
          if (it.amount == null) continue;
          await apiFetch(`/advance-vouchers/${created.id}/items`, {
            method: 'POST',
            body: JSON.stringify({ amount: it.amount, note: it.note?.trim() ? it.note.trim() : null }),
          });
        }
        if (items.length) message.success(`Đã tạo phiếu + ${items.length} khoản chi`);
        else message.success('Đã tạo phiếu chi tạm ứng');
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
      const custId = detail.customerId ?? detail.customer?.id ?? undefined;
      form.setFieldsValue({
        customerId: custId,
        orderFrom: detail.fromLocation ?? '',
        orderTo: detail.toLocation ?? '',
        containerQty: detail.containerQuantity != null && String(detail.containerQuantity).trim() !== '' && !Number.isNaN(Number(detail.containerQuantity)) ? Number(detail.containerQuantity) : undefined,
      });
      // đảm bảo khách của Job có trong list để hiện tên, không hiện ID
      if (custId != null) {
        const cName = detail.customer?.companyName ?? '';
        setCustomers((prev) => (prev.some((c) => c.id === custId) ? prev : [...prev, { id: custId, customerName: cName, companyName: cName }]));
        ensureCustomerOption(custId);
      }
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
              placeholder={isChiTamUng ? 'Bắt buộc chọn Job cho Chi tạm ứng' : 'Gõ để tìm Job...'}
              showSearch
              filterOption={false}
              onSearch={handleSheetSearch}
              notFoundContent={fetchingSheets ? <Spin size="small" /> : null}
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
              placeholder="Gõ để tìm khách hàng..."
              showSearch
              filterOption={false}
              onSearch={handleCustomerSearch}
              notFoundContent={fetchingCustomers ? <Spin size="small" /> : null}
              options={customers.map((c) => ({
                value: c.id,
                label: `#${c.id} - ${c.companyName || c.customerName}`,
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
        {!editingId && (
          <div className="border-t pt-3 mt-3">
            <div className="flex items-center justify-between mb-2">
              <strong>Các khoản chi ({items.length}){itemsTotal > 0 ? ` - Tổng: ${itemsTotal.toLocaleString('vi-VN')}` : ''}</strong>
              <Button size="small" icon={<PlusOutlined />} onClick={addItem}>Thêm khoản chi</Button>
            </div>
            {items.map((it, idx) => (
              <Space key={idx} style={{ display: 'flex', marginBottom: 8 }} align="start">
                <InputNumber
                  min={0}
                  style={{ width: 180 }}
                  placeholder="Số tiền"
                  value={it.amount}
                  onChange={(v) => updateItem(idx, { amount: v == null ? undefined : Number(v) })}
                  formatter={(value: any) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                  parser={parseMoneyInput}
                />
                <Input
                  style={{ width: 280 }}
                  placeholder="Ghi chú khoản chi"
                  value={it.note}
                  onChange={(e) => updateItem(idx, { note: e.target.value })}
                />
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeItem(idx)} />
              </Space>
            ))}
            {!items.length && <div style={{ fontSize: 13, color: '#999' }}>Chưa có khoản chi nào — có thể thêm sau ở chi tiết phiếu.</div>}
          </div>
        )}
        {selectedSheet?.customer && (
          <div style={{ fontSize: 13, color: '#999', marginTop: -8 }}>
            Khách hàng của Job: {selectedSheet.customer.companyName}
          </div>
        )}
      </Form>
    </Modal>
  );
}