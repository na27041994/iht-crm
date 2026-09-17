'use client';
const MONEY_SCALE = 100;

import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, DatePicker, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { DownloadOutlined, PrinterOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { apiDownload, apiFetch, saveBlob } from '@/lib/api';

interface CustomerRef {
  id: number;
  customerName: string;
  companyName: string;
}

interface AdvanceVoucher {
  id: number;
  advanceNo: string;
  type: string;
  advanceDate: string;
  currency: string;
  customer: CustomerRef | null;
  sheet: { id: number; sheetNumber: string } | null;
  createdBy: { fullName: string } | null;
  totalAmount: number;
  note: string | null;
}

interface ListResponse {
  items: AdvanceVoucher[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const ADVANCE_TYPES = ['Chi tạm ứng', 'Phiếu tạm ứng', 'Chi trực tiếp'] as const;

export default function AdvanceVoucherReportPage() {
  const { message } = App.useApp();
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [customerId, setCustomerId] = useState<number | undefined>(undefined);
  const [customers, setCustomers] = useState<CustomerRef[]>([]);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const loadCustomers = useCallback(async () => {
    try {
      const res = await apiFetch<{ items: CustomerRef[] }>('/customers?pageSize=200');
      setCustomers(res.items);
    } catch {}
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const load = useCallback(
    async (pg = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(pg), pageSize: String(pageSize) });
        if (search.trim()) params.set('search', search.trim());
        if (typeFilter) params.set('type', typeFilter);
        if (customerId) params.set('customerId', String(customerId));
        if (range?.[0]) params.set('from', range[0].format('YYYY-MM-DD'));
        if (range?.[1]) params.set('to', range[1].format('YYYY-MM-DD'));
        const res = await apiFetch<ListResponse>(`/advance-vouchers?${params}`);
        setData(res);
        setPage(pg);
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Không tải được danh sách phiếu');
      } finally {
        setLoading(false);
      }
    },
    [message, search, typeFilter, customerId, range],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  // Hàm handleSearch: xử lý handleSearch
  const handleSearch = () => load(1);

  // Hàm openPrint: xử lý openPrint
  const openPrint = (ids: number[]) => {
    if (!ids.length) {
      message.warning('Chưa chọn phiếu');
      return;
    }
    window.open(`/print/advance-vouchers?ids=${ids.join(',')}`, '_blank', 'noopener');
  };

  // Hàm handleExportSelected: xử lý handleExportSelected
  const handleExportSelected = async () => {
    if (!selectedIds.length) {
      message.warning('Chưa chọn phiếu');
      return;
    }
    setExporting(true);
    try {
      const params = new URLSearchParams({ ids: selectedIds.join(',') });
      const blob = await apiDownload(`/advance-vouchers/export?${params}`);
      saveBlob(blob, `phieu-bu-tra_${selectedIds.length}_phieu.xlsx`);
      message.success(`Đã xuất ${selectedIds.length} phiếu`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xuất Excel thất bại');
    } finally {
      setExporting(false);
    }
  };

  // Hàm handleExportFiltered: xử lý handleExportFiltered
  const handleExportFiltered = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (typeFilter) params.set('type', typeFilter);
      if (customerId) params.set('customerId', String(customerId));
      if (range?.[0]) params.set('from', range[0].format('YYYY-MM-DD'));
      if (range?.[1]) params.set('to', range[1].format('YYYY-MM-DD'));
      const blob = await apiDownload(`/advance-vouchers/export?${params}`);
      saveBlob(blob, `phieu-bu-tra_loc.xlsx`);
      message.success('Đã xuất Excel');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xuất Excel thất bại');
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnsType<AdvanceVoucher> = [
    { title: 'Số phiếu', dataIndex: 'advanceNo', width: 140, render: (v: string) => <span className="font-medium">{v}</span> },
    { title: 'Loại', dataIndex: 'type', width: 140, render: (v: string) => <Tag color={v.includes('Chi trực tiếp') ? 'green' : 'blue'}>{v}</Tag> },
    {
      title: 'Ngày chi',
      dataIndex: 'advanceDate',
      width: 120,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    { title: 'Tiền tệ', dataIndex: 'currency', width: 80, align: 'center' as const, render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Phiếu theo dõi', dataIndex: ['sheet', 'sheetNumber'], width: 140, render: (v: string) => v ?? '-' },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_: unknown, r: AdvanceVoucher) => r.customer?.companyName ?? r.customer?.customerName ?? '-',
    },
    { title: 'Người tạo', dataIndex: ['createdBy', 'fullName'], width: 140, render: (v: string) => v ?? '-' },
    {
      title: 'Tổng tiền',
      dataIndex: 'totalAmount',
      width: 140,
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('vi-VN'),
    },
  ];

  const totalSelected = selectedIds.length;
  const selectedAmount = data?.items.filter((x) => selectedIds.includes(x.id)).reduce((s, x) => s + Number(x.totalAmount), 0) ?? 0;

  return (
    <div>
      <div className="mb-4">
        <Typography.Title level={3} style={{ margin: 0 }}>
          Thống kê phiếu bù và phiếu trả
        </Typography.Title>
        <Typography.Text type="secondary">Chi trực tiếp và chi tạm ứng — chọn phiếu để in và xuất Excel</Typography.Text>
      </div>

      <Card size="small" style={{ marginBottom: 12 }}>
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Tìm theo số phiếu, loại, khách hàng..."
            style={{ width: 260 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
          />
          <Select
            value={typeFilter}
            onChange={(v) => setTypeFilter(v)}
            style={{ width: 180 }}
            placeholder="Lọc theo loại"
            options={ADVANCE_TYPES.map((t) => ({ value: t, label: t }))}
            allowClear
          />
          <Select
            value={customerId}
            onChange={(v) => setCustomerId(v)}
            style={{ width: 220 }}
            placeholder="Khách hàng"
            showSearch
            optionFilterProp="label"
            options={customers.map((c) => ({ value: c.id, label: c.companyName || c.customerName }))}
            allowClear
          />
          <DatePicker.RangePicker
            value={range}
            onChange={(vals) => {
              if (vals && vals[0] && vals[1]) setRange([vals[0], vals[1]]);
              else setRange(null);
            }}
            allowClear
            placeholder={['Từ ngày', 'Đến ngày']} format="DD/MM/YYYY"
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            Lọc
          </Button>
        </div>
      </Card>

      <Card size="small" style={{ marginBottom: 12 }}>
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <Space>
            <Button icon={<PrinterOutlined />} disabled={!totalSelected} onClick={() => openPrint(selectedIds)}>
              In {totalSelected ? `(${totalSelected})` : ''} đã chọn
            </Button>
            <Button icon={<DownloadOutlined />} loading={exporting} disabled={!totalSelected} onClick={handleExportSelected}>
              Xuất Excel đã chọn {totalSelected ? `(${totalSelected})` : ''}
            </Button>
            <Button loading={exporting} onClick={handleExportFiltered}>
              Xuất toàn bộ lọc
            </Button>
            {totalSelected > 0 && (
              <Button onClick={() => setSelectedIds([])}>Bỏ chọn</Button>
            )}
          </Space>
          <div className="text-sm">
            <span className="text-gray-500">Đã chọn:</span> <strong>{totalSelected}</strong> phiếu
            {totalSelected > 0 && <span className="ml-3 text-gray-500">Tổng tiền:</span>}
            {totalSelected > 0 && <strong className="ml-1">{(selectedAmount / MONEY_SCALE).toLocaleString('vi-VN')}</strong>}
          </div>
        </div>
      </Card>

      <Table<AdvanceVoucher>
        rowKey="id"
        loading={loading}
        dataSource={data?.items ?? []}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as number[]),
          preserveSelectedRowKeys: true,
        }}
        pagination={{
          current: data?.page ?? page,
          pageSize: data?.pageSize ?? pageSize,
          total: data?.total ?? 0,
          showSizeChanger: false,
          onChange: (p) => load(p),
          showTotal: (t) => `${t} phiếu`,
        }}
        scroll={{ x: 1100 }}
        columns={columns}
        locale={{ emptyText: 'Không có dữ liệu' }}
      />
    </div>
  );
}
