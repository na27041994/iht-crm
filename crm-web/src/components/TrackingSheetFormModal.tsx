'use client';

import { useEffect, useRef, useState } from 'react';
import { App, DatePicker, Form, Input, InputNumber, Modal, Select, Spin } from 'antd';
import dayjs from 'dayjs';
import { apiFetch } from '@/lib/api';
import { formatMoneyInput, parseMoneyInput } from '@/lib/numberFormat';

interface UserOption {
  id: number;
  fullName: string;
}

interface CustomerOption {
  id: number;
  code?: string | null;
  customerName: string;
  companyName: string;
}

interface AgentOption {
  id: number;
  agentName: string;
  companyName: string;
}

export interface TrackingSheetFormValues {
  docStaffId?: number;
  deliveryStaffId?: number;
  nw?: number;
  containerNumber?: string;
  customerId?: number;
  carrierName?: string;
  agentId?: number;
  fromLocation?: string;
  toLocation?: string;
  containerQuantity?: string;
  etaDate?: string;
  gw?: number;
  customNo?: string;
  declarationDate?: string;
  billNumber?: string;
  invoiceNumber?: string;
  pol?: string;
  pod?: string;
  phanLuong?: string;
  note?: string;
}

interface TrackingSheetFormModalProps {
  open: boolean;
  editingId: number | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function TrackingSheetFormModal({
  open,
  editingId,
  onClose,
  onSaved,
}: TrackingSheetFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [fetchingCustomers, setFetchingCustomers] = useState(false);
  const customerSearchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);

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

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      apiFetch<UserOption[]>('/auth/users'),
      apiFetch<{ items: CustomerOption[] }>('/customers?pageSize=100'),
      apiFetch<{ items: AgentOption[] }>('/agents?pageSize=100'),
    ])
      .then(([us, cs, ag]) => {
        setUsers(us);
        setCustomers(cs.items);
        setAgents(ag.items);
        form.resetFields();
        if (editingId) {
          return apiFetch<TrackingSheetFormValues & { id: number; sheetNumber: string; etaDate: string | null; declarationDate: string | null }>(
            `/tracking-sheets/${editingId}`,
          ).then((s) => {
            form.setFieldsValue({
              nw: s.nw == null ? undefined : Number(s.nw),
              containerNumber: s.containerNumber ?? '',
              customerId: s.customerId ?? undefined,
              carrierName: (s as any).carrierName ?? '',
              agentId: s.agentId ?? undefined,
              fromLocation: s.fromLocation ?? '',
              toLocation: s.toLocation ?? '',
              containerQuantity: (s as any).containerQuantity ?? '',
              etaDate: s.etaDate ? dayjs(s.etaDate) : undefined,
              gw: s.gw == null ? undefined : Number(s.gw),
              customNo: s.customNo ?? '',
              declarationDate: s.declarationDate ? dayjs(s.declarationDate) : undefined,
              billNumber: s.billNumber ?? '',
              invoiceNumber: s.invoiceNumber ?? '',
              phanLuong: (s as any).phanLuong ?? '',
              note: s.note ?? '',
            });
          });
        }
        return Promise.resolve();
      })
      .catch((err) => message.error(err instanceof Error ? err.message : 'Không tải được dữ liệu'))
      .finally(() => setLoading(false));
  }, [open, editingId, form, message]);

  // Hàm handleSubmit: xử lý handleSubmit (chống double-click tạo trùng)
  async function handleSubmit(values: TrackingSheetFormValues) {
    if (saving) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        docStaffId: null,
        deliveryStaffId: null,
        nw: values.nw ?? null,
        containerNumber: values.containerNumber && String(values.containerNumber).trim() !== '' ? String(values.containerNumber).trim() : null,
        customerId: values.customerId ?? null,
        carrierName: values.carrierName && String(values.carrierName).trim() !== '' ? String(values.carrierName).trim() : null,
        agentId: values.agentId ?? null,
        fromLocation: values.fromLocation && String(values.fromLocation).trim() !== '' ? String(values.fromLocation).trim() : null,
        toLocation: values.toLocation && String(values.toLocation).trim() !== '' ? String(values.toLocation).trim() : null,
        containerQuantity: values.containerQuantity && String(values.containerQuantity).trim() !== '' ? String(values.containerQuantity).trim() : null,
        etaDate: values.etaDate ? dayjs(values.etaDate).format('YYYY-MM-DD') : null,
        gw: values.gw ?? null,
        customNo: values.customNo && String(values.customNo).trim() !== '' ? String(values.customNo).trim() : null,
        declarationDate: values.declarationDate ? dayjs(values.declarationDate).format('YYYY-MM-DD') : null,
        billNumber: values.billNumber && String(values.billNumber).trim() !== '' ? String(values.billNumber).trim() : null,
        invoiceNumber: values.invoiceNumber && String(values.invoiceNumber).trim() !== '' ? String(values.invoiceNumber).trim() : null,
        pol: null,
        pod: null,
        phanLuong: values.phanLuong && String(values.phanLuong).trim() !== '' ? String(values.phanLuong).trim() : null,
        note: values.note && String(values.note).trim() !== '' ? String(values.note).trim() : null,
      };

      if (editingId) {
        await apiFetch(`/tracking-sheets/${editingId}`, { method: 'PUT', body: JSON.stringify(body) });
        message.success('Đã cập nhật phiếu theo dõi');
      } else {
        await apiFetch('/tracking-sheets', { method: 'POST', body: JSON.stringify(body) });
        message.success('Đã tạo phiếu theo dõi');
      }
      onSaved();
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  const todayPrefix = `J${dayjs().format('YYMMDD')}`;

  return (
    <Modal
      open={open}
      title={editingId ? 'Sửa phiếu theo dõi' : 'Tạo phiếu theo dõi'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editingId ? 'Lưu thay đổi' : 'Tạo phiếu'}
      confirmLoading={saving}
      width={720}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          {editingId ? (
            <Form.Item label="Mã phiếu" name="sheetNumber">
              <Input disabled />
            </Form.Item>
          ) : (
            <Form.Item label="Mã phiếu (tự sinh)">
              <Input value={`${todayPrefix}-xxx`} disabled />
            </Form.Item>
          )}
          <Form.Item label="Mã khách hàng" name="customerId">
            <Select
              placeholder="Gõ để tìm khách hàng (theo tên, công ty)..."
              showSearch
              filterOption={false}
              onSearch={handleCustomerSearch}
              notFoundContent={fetchingCustomers ? <Spin size="small" /> : null}
              options={customers.map((c) => ({
                value: c.id,
                label: `${c.code ?? `#${c.id}`} - ${c.customerName} (${c.companyName})`,
              }))}
            />
          </Form.Item>
          <Form.Item label="Hãng tàu" name="carrierName">
            <Input placeholder="Nhập tên hãng tàu" />
          </Form.Item>
          <Form.Item label="Đại lý" name="agentId">
            <Select
              placeholder="Chọn đại lý"
              showSearch
              optionFilterProp="label"
              options={agents.map((a) => ({
                value: a.id,
                label: a.agentName,
              }))}
            />
          </Form.Item>
          <Form.Item label="Số container" name="containerNumber">
            <Input placeholder="VD: MSKU1234567" />
          </Form.Item>
          <Form.Item label="Số lượng container" name="containerQuantity">
            <Input placeholder="VD: 1 hoặc 2x40HC" />
          </Form.Item>
          <Form.Item label="Từ (From)" name="fromLocation">
            <Input placeholder="VD: Cat Lai Port, HCM" />
          </Form.Item>
          <Form.Item label="Đến (To)" name="toLocation">
            <Input placeholder="VD: Shanghai Port" />
          </Form.Item>
          <Form.Item label="NW (kg)" name="nw">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Net weight" formatter={(value: any) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} parser={parseMoneyInput} />
          </Form.Item>
          <Form.Item label="GW (kg)" name="gw">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Gross weight" formatter={(value: any) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} parser={parseMoneyInput} />
          </Form.Item>
          <Form.Item label="Ngày ETA/ETD" name="etaDate">
            <DatePicker style={{ width: '100%' }} placeholder="dd/mm/yyyy" format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item label="Phân Luồng" name="phanLuong">
            <Input placeholder="VD: Xanh, Vàng, Đỏ" />
          </Form.Item>
          <Form.Item label="Custom No" name="customNo">
            <Input placeholder="Số tờ khai hải quan" />
          </Form.Item>
          <Form.Item label="Ngày tờ khai" name="declarationDate">
            <DatePicker style={{ width: '100%' }} placeholder="dd/mm/yyyy" format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item label="Số bill" name="billNumber">
            <Input placeholder="VD: MSK1234567890" />
          </Form.Item>
          <Form.Item label="Invoice No" name="invoiceNumber">
            <Input placeholder="VD: INV-2026-0001" />
          </Form.Item>
          <Form.Item label="Ghi chú" name="note" className="sm:col-span-2">
            <Input.TextArea rows={3} placeholder="Ghi chú thêm" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}