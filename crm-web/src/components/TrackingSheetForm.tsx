'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { App, Form, Input, InputNumber, Select, Spin } from 'antd';
import dayjs from 'dayjs';
import { apiFetch } from '@/lib/api';
import { formatMoneyInput, parseMoneyInput } from '@/lib/numberFormat';
import { SlashDatePicker } from '@/components/SlashDatePicker';

interface CarrierOption {
  id: number;
  carrierName: string;
  companyName: string;
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
  carrierId?: number;
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
  consignee?: string;
  shipper?: string;
  note?: string;
}

export interface TrackingSheetFormHandle {
  submit: () => void;
}

interface TrackingSheetFormProps {
  editingId: number | null;
  onSaved: () => void;
  onSavingChange?: (saving: boolean) => void;
  // Class grid bao các field (inline ở detail dùng nhiều cột hơn modal)
  gridClassName?: string;
}

// Form phiếu theo dõi dùng chung cho modal (tạo/sửa) và sửa inline ở trang chi tiết
const TrackingSheetForm = forwardRef<TrackingSheetFormHandle, TrackingSheetFormProps>(function TrackingSheetForm(
  { editingId, onSaved, onSavingChange, gridClassName = 'grid grid-cols-1 gap-x-4 sm:grid-cols-2' },
  ref,
) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [fetchingCustomers, setFetchingCustomers] = useState(false);
  const customerSearchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [carriers, setCarriers] = useState<CarrierOption[]>([]);
  const [fetchingCarriers, setFetchingCarriers] = useState(false);
  const carrierSearchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [fetchingAgents, setFetchingAgents] = useState(false);
  const agentSearchTimeout = useRef<NodeJS.Timeout | null>(null);

  useImperativeHandle(ref, () => ({ submit: () => form.submit() }), [form]);

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
  async function fetchCarriers(search: string) {
    setFetchingCarriers(true);
    try {
      const params = new URLSearchParams({ pageSize: '50' });
      if (search) params.set('search', search);
      const res = await apiFetch<{ items: CarrierOption[] }>(`/carriers?${params}`);
      setCarriers(res.items);
    } catch {
      // ignore
    } finally {
      setFetchingCarriers(false);
    }
  }
  function handleCarrierSearch(value: string) {
    if (carrierSearchTimeout.current) clearTimeout(carrierSearchTimeout.current);
    carrierSearchTimeout.current = setTimeout(() => fetchCarriers(value), 300);
  }
  async function fetchAgents(search: string) {
    setFetchingAgents(true);
    try {
      const params = new URLSearchParams({ pageSize: '50' });
      if (search) params.set('search', search);
      const res = await apiFetch<{ items: AgentOption[] }>(`/agents?${params}`);
      setAgents(res.items);
    } catch {
      // ignore
    } finally {
      setFetchingAgents(false);
    }
  }
  function handleAgentSearch(value: string) {
    if (agentSearchTimeout.current) clearTimeout(agentSearchTimeout.current);
    agentSearchTimeout.current = setTimeout(() => fetchAgents(value), 300);
  }
  // Nạp riêng option đang được chọn để hiện tên thay vì ID (khi sửa)
  function ensureOption<T extends { id: number }>(
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    fetcher: Promise<T>,
  ) {
    fetcher
      .then((one) => setter((prev) => (prev.some((x) => x.id === one.id) ? prev : [...prev, one])))
      .catch(() => {});
  }

  useEffect(() => {
    setLoading(true);
    // Tải sẵn 50 dòng mỗi dropdown (thiếu quyền xem thì để trống, không chặn form)
    Promise.all([
      apiFetch<{ items: CustomerOption[] }>('/customers?pageSize=50').catch(() => ({ items: [] as CustomerOption[] })),
      apiFetch<{ items: CarrierOption[] }>('/carriers?pageSize=50').catch(() => ({ items: [] as CarrierOption[] })),
      apiFetch<{ items: AgentOption[] }>('/agents?pageSize=50').catch(() => ({ items: [] as AgentOption[] })),
    ])
      .then(([cs, ca, ag]) => {
        setCustomers(cs.items);
        setCarriers(ca.items);
        setAgents(ag.items);
        form.resetFields();
        if (!editingId) return Promise.resolve();
        return apiFetch<TrackingSheetFormValues & { id: number; sheetNumber: string; etaDate: string | null; declarationDate: string | null }>(
          `/tracking-sheets/${editingId}`,
        ).then((s) => {
        form.setFieldsValue({
              sheetNumber: (s as any).sheetNumber ?? '',
              nw: s.nw == null ? undefined : Number(s.nw),
              containerNumber: s.containerNumber ?? '',
              customerId: s.customerId ?? undefined,
              carrierId: (s as any).carrierId ?? undefined,
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
              consignee: (s as any).consignee ?? '',
              shipper: (s as any).shipper ?? '',
              note: s.note ?? '',
            });
            // nạp thêm option đang chọn nếu nằm ngoài 50 dòng tải sẵn
            if (s.customerId != null) {
              ensureOption(setCustomers, apiFetch<CustomerOption>(`/customers/${s.customerId}`));
            }
            if ((s as any).carrierId != null) {
              ensureOption(setCarriers, apiFetch<CarrierOption>(`/carriers/${(s as any).carrierId}`));
            }
            if (s.agentId != null) {
              ensureOption(setAgents, apiFetch<AgentOption>(`/agents/${s.agentId}`));
            }
          });
        })
      .catch((err) => message.error(err instanceof Error ? err.message : 'Không tải được dữ liệu'))
      .finally(() => setLoading(false));
  }, [editingId, form, message]);

  // Hàm handleSubmit: xử lý handleSubmit (chống double-click tạo trùng)
  async function handleSubmit(values: TrackingSheetFormValues) {
    if (saving) return;
    setSaving(true);
    onSavingChange?.(true);
    try {
      const body: Record<string, unknown> = {
        docStaffId: null,
        deliveryStaffId: null,
        nw: values.nw ?? null,
        containerNumber: values.containerNumber && String(values.containerNumber).trim() !== '' ? String(values.containerNumber).trim() : null,
        customerId: values.customerId ?? null,
        carrierId: values.carrierId ?? null,
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
        consignee: values.consignee && String(values.consignee).trim() !== '' ? String(values.consignee).trim() : null,
        shipper: values.shipper && String(values.shipper).trim() !== '' ? String(values.shipper).trim() : null,
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
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
  }

  const todayPrefix = `J${dayjs().format('YYMMDD')}`;

  return (
    <Spin spinning={loading}>
      <div className="ts-form-compact">
      <Form form={form} layout="vertical" size="small" onFinish={handleSubmit} style={{ marginTop: 12 }}>
        <div className={gridClassName}>
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
              allowClear
              options={customers.map((c) => ({
                value: c.id,
                label: `${c.code ?? `#${c.id}`} - ${c.customerName} (${c.companyName})`,
              }))}
            />
          </Form.Item>
          <Form.Item label="Hãng tàu" name="carrierId">
            <Select
              placeholder="Gõ để tìm hãng tàu..."
              showSearch
              filterOption={false}
              onSearch={handleCarrierSearch}
              notFoundContent={fetchingCarriers ? <Spin size="small" /> : null}
              allowClear
              options={carriers.map((c) => ({
                value: c.id,
                label: c.carrierName,
              }))}
            />
          </Form.Item>
          <Form.Item label="Đại lý" name="agentId">
            <Select
              placeholder="Gõ để tìm đại lý..."
              showSearch
              filterOption={false}
              onSearch={handleAgentSearch}
              notFoundContent={fetchingAgents ? <Spin size="small" /> : null}
              allowClear
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
            <SlashDatePicker style={{ width: '100%' }} placeholder="dd/mm/yyyy" format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item label="Phân Luồng" name="phanLuong">
            <Input placeholder="VD: Xanh, Vàng, Đỏ" />
          </Form.Item>
          <Form.Item label="Custom No" name="customNo">
            <Input placeholder="Số tờ khai hải quan" />
          </Form.Item>
          <Form.Item label="Ngày tờ khai" name="declarationDate">
            <SlashDatePicker style={{ width: '100%' }} placeholder="dd/mm/yyyy" format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item label="Số bill" name="billNumber">
            <Input placeholder="VD: MSK1234567890" />
          </Form.Item>
          <Form.Item label="Invoice No" name="invoiceNumber">
            <Input placeholder="VD: INV-2026-0001" />
          </Form.Item>
          <Form.Item label="Consignee" name="consignee">
            <Input placeholder="Người nhận hàng" />
          </Form.Item>
          <Form.Item label="Shipper" name="shipper">
            <Input placeholder="Người gửi hàng" />
          </Form.Item>
          <Form.Item label="Ghi chú" name="note" className="sm:col-span-full">
            <Input.TextArea rows={2} placeholder="Ghi chú thêm" />
          </Form.Item>
        </div>
      </Form>
      <style>{`.ts-form-compact .ant-form-item { margin-bottom: 10px; } .ts-form-compact .ant-form-item-label { padding-bottom: 2px; }`}</style>
      </div>
    </Spin>
  );
});

export default TrackingSheetForm;
