'use client';

import { useEffect, useState } from 'react';
import { App, Button, DatePicker, Form, Input, Modal, Select } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { apiDownload, apiFetch, saveBlob } from '@/lib/api';

interface CustomerOption {
  id: number;
  customerName: string;
  companyName: string;
}

interface ExportFormValues {
  search?: string;
  customerId?: number;
  range?: [Dayjs, Dayjs];
}

interface ExportExcelModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ExportExcelModal({ open, onClose }: ExportExcelModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    apiFetch<{ items: CustomerOption[] }>('/customers?pageSize=100')
      .then((res) => setCustomers(res.items))
      .catch((err) => message.error(err instanceof Error ? err.message : 'Không tải được khách hàng'));
  }, [open, message]);

  // Hàm handleExport: xử lý handleExport
  async function handleExport(values: ExportFormValues) {
    setExporting(true);
    try {
      const q = new URLSearchParams();
      if (values.search && values.search.trim()) q.set('search', values.search.trim());
      if (values.customerId) q.set('customerId', String(values.customerId));
      if (values.range?.[0]) q.set('from', values.range[0].startOf('day').toISOString());
      if (values.range?.[1]) q.set('to', values.range[1].endOf('day').toISOString());
      const blob = await apiDownload(`/tracking-sheets/export?${q.toString()}`);
      saveBlob(blob, `phieu-theo-doi-${dayjs().format('YYYYMMDD-HHmmss')}.xlsx`);
      message.success('Đã xuất file Excel');
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xuất Excel thất bại');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Xuất Excel phiếu theo dõi"
      onCancel={onClose}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onClose}>
          Bỏ qua
        </Button>,
        <Button key="export" type="primary" icon={<DownloadOutlined />} loading={exporting} onClick={() => form.submit()}>
          Xuất Excel
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" onFinish={handleExport} style={{ marginTop: 16 }}>
        <Form.Item label="Tìm kiếm (mã phiếu, container, tuyến...)" name="search">
          <Input placeholder="Bỏ trống để lấy tất cả" allowClear />
        </Form.Item>
        <Form.Item label="Khách hàng" name="customerId">
          <Select
            placeholder="Tất cả khách hàng"
            allowClear
            showSearch
            optionFilterProp="label"
            options={customers.map((c) => ({ value: c.id, label: c.companyName || c.customerName }))}
          />
        </Form.Item>
        <Form.Item label="Khoảng ngày (ngày tạo)" name="range">
          <DatePicker.RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
        </Form.Item>
      </Form>
    </Modal>
  );
}