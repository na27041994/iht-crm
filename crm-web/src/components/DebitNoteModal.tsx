'use client';

import { useEffect, useState } from 'react';
import { App, Checkbox, Form, Input, InputNumber, Modal, Select } from 'antd';
import { apiFetch } from '@/lib/api';
import { JOB_TYPES, TAX_RATES } from '@/lib/jobTypes';

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
}

export default function DebitNoteModal({ open, sheetId, editing, onClose, onSaved }: DebitNoteModalProps) {
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
    form.setFieldsValue({ total: base * taxFactor });
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
    // pretax = total / (1 + tax%) to get pre-tax amount
    const pretax = dTax > 0 ? Math.round((dTotal / (1 + dTax / 100)) * 100) / 100 : dTotal;
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
    const tax = (p * r) / 100;
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
        message.success('Đã cập nhật Debit Note');
      } else {
        savedDebit = await apiFetch(`/tracking-sheets/${sheetId}/debit-notes`, { method: 'POST', body: JSON.stringify(body) });
        message.success('Đã thêm Debit Note');
      }

      // Also create Job Booking
      if (alsoCreateBooking && !editing) {
        const jbValues = await jbForm.validateFields();
        const jbBody: Record<string, unknown> = {
          type: jbValues.type,
          description: values.description?.trim() || null,
          unit: jbValues.unit || values.unit || null,
          quantity: jbValues.quantity ?? 1,
          pretaxAmount: jbValues.pretaxAmount ?? 0,
          taxRate: jbValues.taxRate ?? 0,
          taxAmount: jbValues.taxAmount ?? 0,
          afterTaxAmount: jbValues.afterTaxAmount ?? 0,
          total: jbValues.total ?? 0,
        };
        await apiFetch(`/tracking-sheets/${sheetId}/job-bookings`, { method: 'POST', body: JSON.stringify(jbBody) });
        message.success('Đã thêm Job Book tàu');
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
      title={editing ? 'Sửa Debit Note' : 'Thêm Debit Note'}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editing ? 'Lưu thay đổi' : 'Thêm mục'}
      confirmLoading={saving}
      width={720}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item label="Loại" name="type" rules={[{ required: true, message: 'Chọn loại' }]} className="sm:col-span-2">
            <Select placeholder="Chọn loại" options={JOB_TYPES.map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item label="Invoice No" name="invoiceNumber">
            <Input placeholder="VD: HD-2026-0088" />
          </Form.Item>
          <Form.Item label="Unit" name="unit">
            <Input placeholder="VD: Cont, Kg..." />
          </Form.Item>
          <Form.Item label="Mô tả" name="description" className="sm:col-span-2">
            <Input placeholder="Mô tả nội dung" />
          </Form.Item>
          <Form.Item label="Current" name="currency">
            <Select options={[{ value: 'VND', label: 'VND' }, { value: 'USD', label: 'USD' }]} />
          </Form.Item>
          <Form.Item label="Số lượng" name="quantity">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Số lượng" formatter={(value: any) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} parser={(value: any) => value ? value.replace(/\./g, '').replace(/,/g, '') : ''} />
          </Form.Item>
          {currency === 'VND' ? (
            <Form.Item label="Giá VND" name="priceVnd">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="Giá theo VND" formatter={(value: any) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} parser={(value: any) => value ? value.replace(/\./g, '').replace(/,/g, '') : ''} />
            </Form.Item>
          ) : (
            <>
              <Form.Item label="Giá (USD)" name="priceUsd">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="Giá theo USD" formatter={(value: any) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} parser={(value: any) => value ? value.replace(/\./g, '').replace(/,/g, '') : ''} />
              </Form.Item>
              <Form.Item label="Tỷ giá" name="exchangeRate">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="VD: 25400" formatter={(value: any) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} parser={(value: any) => value ? value.replace(/\./g, '').replace(/,/g, '') : ''} />
              </Form.Item>
            </>
          )}
          <Form.Item label="Thuế (%)" name="taxRate">
            <Select placeholder="Chọn thuế" options={[{ value: 0, label: '0%' }, { value: 8, label: '8%' }, { value: 10, label: '10%' }]} />
          </Form.Item>
          <Form.Item label="Tổng tiền" name="total" className="sm:col-span-2">
            <InputNumber min={0} style={{ width: '100%' }} disabled formatter={(value: any) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} parser={(value: any) => value ? value.replace(/\./g, '').replace(/,/g, '') : ''} />
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
                  initialValue="Our Company Pay"
                >
                  <Select placeholder="Chọn loại" options={JOB_TYPES.map((t) => ({ value: t, label: t }))} />
                </Form.Item>
                <Form.Item label="Unit" name="unit" initialValue="Cont">
                  <Input placeholder="VD: Cont, Chuyến..." />
                </Form.Item>
                <Form.Item label="Số lượng" name="quantity" initialValue={1}>
                  <InputNumber min={0} style={{ width: '100%' }} formatter={(value: any) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} parser={(value: any) => value ? value.replace(/\./g, '').replace(/,/g, '') : ''} />
                </Form.Item>
                <Form.Item
                  label="Trước thuế (tự điền từ Debit)"
                  name="pretaxAmount"
                  rules={[{ required: true, message: 'Nhập số tiền trước thuế' }]}
                >
                  <InputNumber min={0} style={{ width: '100%' }} formatter={(value: any) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} parser={(value: any) => value ? value.replace(/\./g, '').replace(/,/g, '') : ''} />
                </Form.Item>
                <Form.Item label="Thuế (%)" name="taxRate" initialValue={0}>
                  <Select placeholder="Chọn thuế" options={TAX_RATES.map((t) => ({ value: t, label: `${t}%` }))} />
                </Form.Item>
                <Form.Item label="Tiền thuế" name="taxAmount">
                  <InputNumber style={{ width: '100%' }} disabled />
                </Form.Item>
                <Form.Item label="Sau thuế" name="afterTaxAmount">
                  <InputNumber style={{ width: '100%' }} disabled />
                </Form.Item>
                <Form.Item label="Tổng tiền" name="total" className="sm:col-span-2">
                  <InputNumber style={{ width: '100%' }} disabled />
                </Form.Item>
              </div>
            </Form>
          )}
        </div>
      )}
    </Modal>
  );
}
