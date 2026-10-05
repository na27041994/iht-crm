'use client';

import { useEffect, useRef, useState } from 'react';
import { App, Form, Input, Modal, Select, Spin } from 'antd';
import dayjs from 'dayjs';
import { apiFetch } from '@/lib/api';
import DecimalInput from '@/components/DecimalInput';
import { SlashDatePicker } from '@/components/SlashDatePicker';

export const RECEIPT_PAYER_TYPES = ['Khách Hàng', 'Cá nhân'] as const;

interface CustomerOption {
  id: number;
  code?: string | null;
  customerName: string;
  companyName: string;
}

interface StaffOption {
  id: number;
  fullName: string;
}

export interface ReceiptVoucherFormValues {
  payerType: string;
  receiptDate: string;
  currency: 'VND' | 'USD';
  customerId?: number;
  payerName?: string;
  staffId?: number;
  amount?: number;
  transFee?: number;
  note?: string;
}

interface ReceiptVoucherFormModalProps {
  open: boolean;
  editingId: number | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function ReceiptVoucherFormModal({
  open,
  editingId,
  onClose,
  onSaved,
}: ReceiptVoucherFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [fetchingCustomers, setFetchingCustomers] = useState(false);
  const customerSearchTimeout = useRef<NodeJS.Timeout | null>(null);

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
      apiFetch<CustomerOption>(`/customers/${customerId}`)
        .then((c) => setCustomers((p) => (p.some((x) => x.id === c.id) ? p : [...p, c])))
        .catch(() => {});
      return prev;
    });
  }

  // Đảm bảo option NV thu đã lưu luôn có trong list để hiện tên thay vì ID
  function ensureStaffOption(staff?: { id: number; fullName: string } | null) {
    if (!staff) return;
    setStaffList((prev) => (prev.some((s) => s.id === staff.id) ? prev : [...prev, staff]));
  }

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      apiFetch<{ items: CustomerOption[] }>('/customers?pageSize=100'),
      apiFetch<StaffOption[]>('/auth/staff-options').catch(() => [] as StaffOption[]),
      apiFetch<{ sub: number } | { id: number }>('/auth/me').catch(() => null),
    ])
      .then(([cs, st, me]) => {
        setCustomers(cs.items);
        setStaffList(st);
        form.resetFields();
        const meId = me ? ('sub' in me ? me.sub : me.id) : undefined;
        form.setFieldsValue({ payerType: 'Khách Hàng', currency: 'VND', receiptDate: dayjs(), staffId: meId, transFee: 0 });
        if (editingId) {
          return apiFetch<
            ReceiptVoucherFormValues & {
              id: number;
              receiptNo: string;
              receiptDate: string;
              staff?: StaffOption | null;
              createdBy?: StaffOption | null;
            }
          >(`/receipt-vouchers/${editingId}`).then((v) => {
            form.setFieldsValue({
              payerType: v.payerType,
              receiptDate: v.receiptDate ? dayjs(v.receiptDate) : dayjs(),
              currency: v.currency as 'VND' | 'USD',
              customerId: v.customerId ?? undefined,
              payerName: (v as any).payerName ?? '',
              staffId: v.staff?.id ?? undefined,
              // DB lưu *100, hiển thị chia 100
              amount: v.amount == null ? undefined : Number(v.amount) / 100,
              transFee: (v as any).transFee == null ? 0 : Number((v as any).transFee) / 100,
              note: v.note ?? '',
            });
            ensureStaffOption(v.staff);
            ensureCustomerOption(v.customerId);
          });
        }
        return Promise.resolve();
      })
      .catch((err) => message.error(err instanceof Error ? err.message : 'Không tải được dữ liệu'))
      .finally(() => setLoading(false));
  }, [open, editingId, form, message]);

  // Hàm handleSubmit: xử lý handleSubmit
  async function handleSubmit(values: ReceiptVoucherFormValues) {
    if (values.amount == null || Number(values.amount) < 0) {
      message.error('Nhập số tiền >= 0');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        payerType: values.payerType,
        receiptDate: dayjs(values.receiptDate).format('YYYY-MM-DD'),
        currency: values.currency,
        customerId: values.payerType === 'Khách Hàng' ? (values.customerId ?? null) : null,
        payerName:
          values.payerType === 'Cá nhân' && values.payerName && String(values.payerName).trim() !== ''
            ? String(values.payerName).trim()
            : null,
        staffId: values.staffId ?? null,
        // gửi tiền hiển thị, API scale x100 khi lưu
        amount: values.amount,
        transFee: values.transFee ?? 0,
        note: values.note && String(values.note).trim() !== '' ? String(values.note).trim() : null,
      };
      if (editingId) {
        await apiFetch(`/receipt-vouchers/${editingId}`, { method: 'PUT', body: JSON.stringify(body) });
        message.success('Đã cập nhật phiếu thu');
      } else {
        await apiFetch(`/receipt-vouchers`, { method: 'POST', body: JSON.stringify(body) });
        message.success('Đã tạo phiếu thu');
      }
      onSaved();
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  const watchedPayerType = Form.useWatch('payerType', form);
  const payerType = watchedPayerType ?? form.getFieldValue('payerType') ?? 'Khách Hàng';
  const isCompany = payerType === 'Khách Hàng';

  return (
    <Modal
      open={open}
      title={editingId ? 'Sửa phiếu thu' : 'Tạo phiếu thu mới'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editingId ? 'Lưu thay đổi' : 'Tạo phiếu'}
      confirmLoading={saving}
      width={720}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item label="Đối tượng nộp" name="payerType" rules={[{ required: true, message: 'Chọn đối tượng' }]}>
            <Select options={RECEIPT_PAYER_TYPES.map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item label="Ngày thu" name="receiptDate" rules={[{ required: true, message: 'Chọn ngày' }]}>
            <SlashDatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item label="Receipt No (tự sinh)">
            <Input value={`${dayjs().format('YYMMDD')}xxx`} disabled />
          </Form.Item>
          <Form.Item label="Tiền tệ" name="currency">
            <Select options={[{ value: 'VND', label: 'VND' }, { value: 'USD', label: 'USD' }]} />
          </Form.Item>
          {isCompany ? (
            <Form.Item
              label="Chọn khách hàng"
              name="customerId"
              rules={[{ required: true, message: 'Chọn khách hàng' }]}
              className="sm:col-span-2"
            >
              <Select
                placeholder="Gõ để tìm khách hàng..."
                showSearch
                filterOption={false}
                onSearch={handleCustomerSearch}
                notFoundContent={fetchingCustomers ? <Spin size="small" /> : null}
                options={customers.map((c) => ({
                  value: c.id,
                  label: `${c.code ?? `#${c.id}`} - ${c.companyName || c.customerName}`,
                }))}
              />
            </Form.Item>
          ) : (
            <Form.Item
              label="Tên người nộp"
              name="payerName"
              rules={[{ required: true, message: 'Nhập tên người nộp' }]}
              className="sm:col-span-2"
            >
              <Input placeholder="Họ tên người nộp tiền" />
            </Form.Item>
          )}
          <Form.Item label="NV thu" name="staffId" tooltip="Nhân viên thu của phiếu này (trống = theo người tạo phiếu)">
            <Select
              placeholder="Mặc định: người tạo phiếu"
              showSearch
              optionFilterProp="label"
              allowClear
              options={staffList.map((s) => ({ value: s.id, label: s.fullName }))}
            />
          </Form.Item>
          <Form.Item label="Số tiền" name="amount" rules={[{ required: true, message: 'Nhập số tiền' }]}>
            <DecimalInput locale="en" placeholder="Số tiền thu" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Phí chuyển khoản" name="transFee">
            <DecimalInput locale="en" placeholder="0" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Lý do nộp" name="note" className="sm:col-span-2">
            <Input.TextArea rows={3} placeholder="VD: TT CÔNG NỢ THÁNG 9/2026" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
