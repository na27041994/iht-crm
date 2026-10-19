'use client';

import { useEffect, useState } from 'react';
import { App, Checkbox, Form, Input, Modal, Select, Tag } from 'antd';
import { apiFetch } from '@/lib/api';
import DecimalInput from '@/components/DecimalInput';
import { JOB_TYPES, TAX_RATES } from '@/lib/jobTypes';
import DescriptionAutocomplete from '@/components/DescriptionAutocomplete';

// Thông tin phiếu truyền từ trang chi tiết để hiển thị cạnh form khi nhập
export interface DebitSheetInfo {
  sheetNumber: string;
  customer: string;
  route: string;
  containerNumber: string;
  containerQuantity: string;
  billNumber: string;
}

export interface DebitNoteItem {
  id: number;
  type: string;
  invoiceNumber: string | null;
  description: string | null;
  unit: string | null;
  currency: string;
  quantity: string | null;
  priceVnd: string | null;
  taxRate: string | null;
  priceUsd: string | null;
  exchangeRate: string | null;
  total: string | null;
  sourceBookingId?: number | null;
}

export interface DebitNoteFormValues {
  type: string;
  invoiceNumber?: string;
  description?: string;
  unit?: string;
  currency: 'VND' | 'USD';
  quantity?: number;
  priceVnd?: number;
  taxRate?: number;
  priceUsd?: number;
  exchangeRate?: number;
  total?: number;
}

interface DebitNoteModalProps {
  open: boolean;
  sheetId: number;
  editing: DebitNoteItem | null;
  onClose: () => void;
  onSaved: () => void;
  sheetInfo?: DebitSheetInfo | null;
}

export default function DebitNoteModal({ open, sheetId, editing, onClose, onSaved, sheetInfo }: DebitNoteModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [jbForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [alsoCreateBooking, setAlsoCreateBooking] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    jbForm.resetFields();
    setAlsoCreateBooking(false);
    form.setFieldsValue({ currency: 'VND', taxRate: 0 });
    jbForm.setFieldsValue({ taxRate: 0 });
    if (editing) {
      // DB lưu *100, hiển thị chia 100
      form.setFieldsValue({
        type: editing.type,
        invoiceNumber: editing.invoiceNumber ?? '',
        description: editing.description ?? '',
        unit: editing.unit ?? '',
        currency: editing.currency as 'VND' | 'USD',
        quantity: editing.quantity == null ? undefined : Number(editing.quantity),
        priceVnd: editing.priceVnd == null ? undefined : Number(editing.priceVnd) / 100,
        taxRate: editing.taxRate == null ? 0 : Number(editing.taxRate),
        priceUsd: editing.priceUsd == null ? undefined : Number(editing.priceUsd) / 100,
        exchangeRate: editing.exchangeRate == null ? undefined : Number(editing.exchangeRate),
        total: editing.total == null ? undefined : Number(editing.total) / 100,
      });
    }
  }, [open, editing, form, jbForm]);

  const currency = Form.useWatch('currency', form);
  const quantity = Form.useWatch('quantity', form);
  const priceVnd = Form.useWatch('priceVnd', form);
  const priceUsd = Form.useWatch('priceUsd', form);
  const exchangeRate = Form.useWatch('exchangeRate', form);
  const taxRate = Form.useWatch('taxRate', form);

  useEffect(() => {
    if (!open) return;
    const q = Number(quantity ?? 0);
    const t = Number(taxRate ?? 0);
    const taxFactor = 1 + t / 100;
    let base = 0;
    if (currency === 'USD') {
      base = q * Number(priceUsd ?? 0) * Number(exchangeRate ?? 0);
    } else {
      base = q * Number(priceVnd ?? 0);
    }
    // Thuế 5% theo hóa đơn thực tế: tổng = trước thuế x 100/95, làm tròn đồng
    const total = t === 5 ? Math.round(base * 100 / 95) : base * taxFactor;
    form.setFieldsValue({ total });
  }, [open, currency, quantity, priceVnd, priceUsd, exchangeRate, taxRate, form]);

  // Auto-fill Job Booking from Debit Note when checkbox is toggled
  const debitTotal = Form.useWatch('total', form);
  const jbPretax = Form.useWatch('pretaxAmount', jbForm);
  const jbTax = Form.useWatch('taxRate', jbForm);
  const jbQty = Form.useWatch('quantity', jbForm);

  useEffect(() => {
    if (!open || !alsoCreateBooking) return;
    const dTax = Number(taxRate ?? 0);
    const dQty = Number(quantity ?? 1);
    const dUnit = form.getFieldValue('unit') || 'Cont';
    const dTotal = Number(debitTotal ?? 0);
    // Debit.total là tổng cả số lượng, Job Book lưu trước thuế theo ĐƠN VỊ
    const dUnitTotal = dQty > 0 ? dTotal / dQty : dTotal;
    // Thuế 5% theo hóa đơn thực tế: trước thuế = tổng x 95%, làm tròn đồng
    const pretax = dTax === 5 ? Math.round(dUnitTotal * 95 / 100) : dTax > 0 ? Math.round((dUnitTotal / (1 + dTax / 100)) * 100) / 100 : dUnitTotal;
    jbForm.setFieldsValue({
      taxRate: dTax,
      quantity: dQty,
      unit: dUnit,
      pretaxAmount: pretax,
    });
  }, [open, alsoCreateBooking, taxRate, quantity, debitTotal, jbForm, form]);

  // Compute JB totals
  useEffect(() => {
    if (!open || !alsoCreateBooking) return;
    const p = Number(jbPretax ?? 0);
    const r = Number(jbTax ?? 0);
    const q = Number(jbQty ?? 1);
    // Thuế 5% theo hóa đơn thực tế: thuế = trước thuế x 5/95, làm tròn đồng
    const tax = r === 5 ? Math.round(p * 5 / 95) : (p * r) / 100;
    const after = p + tax;
    const total = after * q;
    jbForm.setFieldsValue({
      taxAmount: tax,
      afterTaxAmount: after,
      total,
    });
  }, [open, alsoCreateBooking, jbPretax, jbTax, jbQty, jbForm]);

  // Hàm handleSubmit: xử lý handleSubmit
  async function handleSubmit(values: DebitNoteFormValues) {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        type: values.type,
        invoiceNumber: values.invoiceNumber && String(values.invoiceNumber).trim() !== '' ? String(values.invoiceNumber).trim() : null,
        description: values.description && String(values.description).trim() !== '' ? String(values.description).trim() : null,
        unit: values.unit && String(values.unit).trim() !== '' ? String(values.unit).trim() : null,
        currency: values.currency,
        quantity: values.quantity ?? null,
        priceVnd: values.currency === 'VND' ? values.priceVnd ?? null : null,
        taxRate: values.taxRate ?? null,
        priceUsd: values.currency === 'USD' ? values.priceUsd ?? null : null,
        exchangeRate: values.currency === 'USD' ? values.exchangeRate ?? null : null,
        total: values.total ?? null,
      };
      let savedDebit: any;
      if (editing) {
        savedDebit = await apiFetch(`/tracking-sheets/${sheetId}/debit-notes/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
        message.success(editing.sourceBookingId ? 'Đã cập nhật Debit Note + Job Book liên kết' : 'Đã cập nhật Debit Note');
      } else {
        if (alsoCreateBooking) {
          const jbValues = await jbForm.validateFields();
          (body as Record<string, unknown>).alsoCreateBooking = true;
          (body as Record<string, unknown>).linkedBooking = {
            type: jbValues.type,
            unit: jbValues.unit || values.unit || null,
            quantity: jbValues.quantity ?? 1,
            pretaxAmount: jbValues.pretaxAmount ?? 0,
            taxRate: jbValues.taxRate ?? 0,
            taxAmount: jbValues.taxAmount ?? 0,
            afterTaxAmount: jbValues.afterTaxAmount ?? 0,
            total: jbValues.total ?? 0,
          };
        }
        savedDebit = await apiFetch(`/tracking-sheets/${sheetId}/debit-notes`, { method: 'POST', body: JSON.stringify(body) });
        message.success(alsoCreateBooking ? 'Đã thêm Debit Note + Job Book tàu liên kết' : 'Đã thêm Debit Note');
      }

      onSaved();
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  // Panel thông tin phiếu hiển thị cạnh form khi nhập
  const infoPanel = sheetInfo ? (
    <div style={{ background: '#f5f5f5', border: '1px solid #e5e5e5', borderRadius: 8, padding: 12, fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Thông tin phiếu</div>
      {[
        ['Mã phiếu', sheetInfo.sheetNumber],
        ['Khách hàng', sheetInfo.customer],
        ['Tuyến', sheetInfo.route],
        ['Container', sheetInfo.containerNumber],
        ['Số lượng container', sheetInfo.containerQuantity],
        ['Bill', sheetInfo.billNumber],
      ].map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: 8, padding: '4px 0', borderTop: '1px solid #e8e8e8' }}>
          <span style={{ color: '#888', minWidth: 90 }}>{k}</span>
          <span style={{ fontWeight: 500 }}>{v}</span>
        </div>
      ))}
    </div>
  ) : null;

  const formBody = (
    <>
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 0 }}>
        {editing?.sourceBookingId != null && (
          <div style={{ marginBottom: 12 }}>
            <Tag color="purple">Liên kết Job Book #{editing.sourceBookingId}</Tag>
            <span style={{ fontSize: 13, color: '#888' }}>Sửa / xóa ở đây sẽ đồng bộ sang Job Book</span>
          </div>
        )}
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item label="Loại" name="type" rules={[{ required: true, message: 'Chọn loại' }]}>
            <Select placeholder="Chọn loại" options={JOB_TYPES.map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item label="Số hoá đơn" name="invoiceNumber">
            <Input placeholder="VD: HD-2026-0088" />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <DescriptionAutocomplete type="debit" placeholder="Gõ để tìm mô tả đã từng nhập..." />
          </Form.Item>
          <Form.Item label="Unit" name="unit">
            <Input placeholder="VD: Cont, Kg..." />
          </Form.Item>
          <Form.Item label="Current" name="currency">
            <Select options={[{ value: 'VND', label: 'VND' }, { value: 'USD', label: 'USD' }]} />
          </Form.Item>
          <Form.Item label="Số lượng" name="quantity">
            <DecimalInput locale="en" maxDecimals={3} placeholder="VD: 1,000.567" style={{ width: '100%' }} />
          </Form.Item>
          {currency === 'VND' ? (
            <Form.Item label="Giá VND" name="priceVnd">
              <DecimalInput locale="vi" placeholder="Giá theo VND" style={{ width: '100%' }} />
            </Form.Item>
          ) : (
            <>
              <Form.Item label="Giá (USD)" name="priceUsd">
                <DecimalInput locale="vi" placeholder="Giá theo USD" style={{ width: '100%' }} />
              </Form.Item>
                <Form.Item label="Tỷ giá" name="exchangeRate">
                  <DecimalInput locale="vi" placeholder="VD: 25.400" style={{ width: '100%' }} />
                </Form.Item>
            </>
          )}
          <Form.Item label="Thuế (%)" name="taxRate">
            <Select placeholder="Chọn thuế" options={[{ value: 0, label: '0%' }, { value: 8, label: '8%' }, { value: 10, label: '10%' }]} />
          </Form.Item>
          <Form.Item label="Tổng tiền" name="total" className="sm:col-span-2">
            <DecimalInput locale="vi" disabled style={{ width: '100%' }} />
          </Form.Item>
        </div>
      </Form>

      {!editing && (
        <div className="border-t pt-3 mt-3">
          <Checkbox
            checked={alsoCreateBooking}
            onChange={(e) => setAlsoCreateBooking(e.target.checked)}
          >
            Đồng thời thêm <strong>Job Book tàu</strong>
          </Checkbox>

          {alsoCreateBooking && (
            <Form form={jbForm} layout="vertical" style={{ marginTop: 12 }}>
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                <Form.Item
                  label="Loại Job Book"
                  name="type"
                  rules={[{ required: true, message: 'Chọn loại' }]}
                  initialValue="Pay In Advance"
                >
                  <Select placeholder="Chọn loại" options={JOB_TYPES.map((t) => ({ value: t, label: t }))} />
                </Form.Item>
                <Form.Item label="Unit" name="unit" initialValue="Cont">
                  <Input placeholder="VD: Cont, Chuyến..." />
                </Form.Item>
                <Form.Item label="Số lượng" name="quantity" initialValue={1}>
                  <DecimalInput locale="en" maxDecimals={3} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  label="Trước thuế (tự điền từ Debit)"
                  name="pretaxAmount"
                  rules={[{ required: true, message: 'Nhập số tiền trước thuế' }]}
                >
                  <DecimalInput locale="vi" style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="Thuế (%)" name="taxRate" initialValue={0}>
                  <Select placeholder="Chọn thuế" options={TAX_RATES.map((t) => ({ value: t, label: `${t}%` }))} />
                </Form.Item>
                <Form.Item label="Tiền thuế" name="taxAmount">
                  <DecimalInput locale="vi" disabled style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="Sau thuế" name="afterTaxAmount">
                  <DecimalInput locale="vi" disabled style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="Tổng tiền" name="total" className="sm:col-span-2">
                  <DecimalInput locale="vi" disabled style={{ width: '100%' }} />
                </Form.Item>
              </div>
            </Form>
          )}
        </div>
      )}
    </>
  );

  const modalTitle = editing ? 'Sửa Debit Note' : 'Thêm Debit Note';

  return (
    <Modal
      open={open}
      title={modalTitle}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editing ? 'Lưu thay đổi' : 'Thêm mục'}
      confirmLoading={saving}
      width={sheetInfo ? 1040 : 720}
      destroyOnHidden
    >
      {sheetInfo ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3" style={{ marginTop: 16 }}>
          <div className="xl:col-span-2">{formBody}</div>
          <div>{infoPanel}</div>
        </div>
      ) : (
        formBody
      )}
    </Modal>
  );
}
