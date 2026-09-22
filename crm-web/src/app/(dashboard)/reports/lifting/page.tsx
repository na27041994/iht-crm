'use client';
const MONEY_SCALE = 100;

import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Input, Select, Space, Table, Typography } from 'antd';
import { DownloadOutlined, PrinterOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { apiDownload, apiFetch, saveBlob } from '@/lib/api';
import { SlashRangePicker } from '@/components/SlashDatePicker';

// Định dạng số tiền/số lượng theo chuẩn vi-VN
const fmtMoney = (v: string | number | null | undefined) =>
  v == null ? '-' : (Number(v) / MONEY_SCALE).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

export default function LiftingReportPage() {
  const { message } = App.useApp();
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [sheetSearch, setSheetSearch] = useState('');
  const [sheetCustomerId, setSheetCustomerId] = useState<number | undefined>(undefined);
  const [customers, setCustomers] = useState<{ id: number; companyName: string; customerName: string }[]>([]);
  const [sheets, setSheets] = useState<any[]>([]);
  const [sheetsTotal, setSheetsTotal] = useState(0);
  const [sheetsPage, setSheetsPage] = useState(1);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [selectedSheetIds, setSelectedSheetIds] = useState<number[]>([]);

  useEffect(() => {
    apiFetch<{ items: { id: number; companyName: string; customerName: string }[] }>('/customers?pageSize=100')
      .then((r) => setCustomers(r.items))
      .catch(() => {});
  }, []);

  const loadSheets = useCallback(
    async (pg = 1) => {
      setSheetsLoading(true);
      try {
        const params = new URLSearchParams({ page: String(pg), pageSize: '20' });
        if (sheetSearch.trim()) params.set('search', sheetSearch.trim());
        if (sheetCustomerId) params.set('customerId', String(sheetCustomerId));
        if (range?.[0]) params.set('from', range[0].format('YYYY-MM-DD'));
        if (range?.[1]) params.set('to', range[1].format('YYYY-MM-DD'));
        const res = await apiFetch<{ items: any[]; total: number }>(`/reports/lifting/sheets?${params}`);
        setSheets(res.items);
        setSheetsTotal(res.total);
        setSheetsPage(pg);
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Không tải được danh sách phiếu');
      } finally {
        setSheetsLoading(false);
      }
    },
    [message, sheetSearch, sheetCustomerId, range],
  );

  useEffect(() => {
    loadSheets(1);
  }, [loadSheets]);

  // Hàm handleSearchSheets: xử lý handleSearchSheets
  function handleSearchSheets() {
    loadSheets(1);
  }

  // Hàm handlePrintSelected: xử lý handlePrintSelected
  function handlePrintSelected() {
    if (!selectedSheetIds.length) {
      message.warning('Chưa chọn phiếu');
      return;
    }
    window.open(`/print/lifting-notes?ids=${selectedSheetIds.join(',')}`, '_blank', 'noopener');
  }

  // Hàm handleExportSelected: xử lý handleExportSelected
  async function handleExportSelected() {
    if (!selectedSheetIds.length) {
      message.warning('Chưa chọn phiếu');
      return;
    }
    setExporting(true);
    try {
      const blob = await apiDownload(`/reports/lifting/export?ids=${selectedSheetIds.join(',')}`);
      saveBlob(blob, `nang_ha_${selectedSheetIds.length}_phieu.xlsx`);
      message.success(`Đã xuất ${selectedSheetIds.length} phiếu`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xuất Excel thất bại');
    } finally {
      setExporting(false);
    }
  }

  // Hàm handleExportAll: xử lý handleExportAll
  async function handleExportAll() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (sheetSearch.trim()) params.set('search', sheetSearch.trim());
      if (sheetCustomerId) params.set('customerId', String(sheetCustomerId));
      if (range?.[0]) params.set('from', range[0].format('YYYY-MM-DD'));
      if (range?.[1]) params.set('to', range[1].format('YYYY-MM-DD'));
      const qs = params.toString();
      const blob = await apiDownload(`/reports/lifting/export${qs ? `?${qs}` : ''}`);
      saveBlob(blob, 'thong-ke-nang-ha.xlsx');
      message.success('Đã xuất Excel');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xuất Excel thất bại');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="mb-4">
        <Typography.Title level={3} style={{ margin: 0 }}>
          Thống kê nâng hạ
        </Typography.Title>
        <Typography.Text type="secondary">
          Tìm phiếu theo dõi, chọn phiếu cần in hoặc xuất Excel
        </Typography.Text>
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Tìm phiếu / container..."
            style={{ width: 260 }}
            value={sheetSearch}
            onChange={(e) => setSheetSearch(e.target.value)}
            onPressEnter={handleSearchSheets}
            allowClear
          />
          <Select
            value={sheetCustomerId}
            onChange={(v) => setSheetCustomerId(v)}
            style={{ width: 220 }}
            placeholder="Khách hàng"
            showSearch
            optionFilterProp="label"
            options={customers.map((c) => ({ value: c.id, label: c.companyName || c.customerName }))}
            allowClear
          />
          <SlashRangePicker
            value={range}
            onChange={(vals) => {
              if (vals && vals[0] && vals[1]) {
                setRange([dayjs(vals[0]), dayjs(vals[1])]);
              } else {
                setRange(null);
              }
              setTimeout(() => loadSheets(1), 0);
            }}
            allowClear
            placeholder={['Từ ngày', 'Đến ngày']} format="DD/MM/YYYY"
          />
          <Button icon={<SearchOutlined />} onClick={handleSearchSheets}>
            Tìm
          </Button>
        </div>
        <div className="mb-3 flex flex-wrap gap-2 items-center">
          <Space>
            <Button icon={<PrinterOutlined />} disabled={!selectedSheetIds.length} onClick={handlePrintSelected}>
              In {selectedSheetIds.length ? `(${selectedSheetIds.length})` : ''} đã chọn
            </Button>
            <Button icon={<DownloadOutlined />} loading={exporting} disabled={!selectedSheetIds.length} onClick={handleExportSelected}>
              Xuất Excel đã chọn {selectedSheetIds.length ? `(${selectedSheetIds.length})` : ''}
            </Button>
            <Button loading={exporting} onClick={handleExportAll}>
              Xuất tất cả
            </Button>
            {selectedSheetIds.length > 0 && <Button onClick={() => setSelectedSheetIds([])}>Bỏ chọn</Button>}
          </Space>
        </div>
        <Table
          rowKey="id"
          loading={sheetsLoading}
          dataSource={sheets}
          rowSelection={{
            selectedRowKeys: selectedSheetIds,
            onChange: (keys) => setSelectedSheetIds(keys as number[]),
            preserveSelectedRowKeys: true,
          }}
          pagination={{
            current: sheetsPage,
            pageSize: 20,
            total: sheetsTotal,
            onChange: (p) => loadSheets(p),
            showSizeChanger: false,
            showTotal: (t) => `${t} phiếu`,
          }}
          scroll={{ x: 900 }}
          columns={[
            { title: 'Mã phiếu', dataIndex: 'sheetNumber', width: 140, render: (v: string) => <span className="font-medium">{v}</span> },
            { title: 'Container', dataIndex: 'containerNumber', width: 140, render: (v: string) => v ?? '-' },
            { title: 'Khách hàng', key: 'customer', render: (_: unknown, r: any) => r.customer?.companyName ?? r.customer?.customerName ?? '-' },
            { title: 'Tuyến', key: 'route', render: (_: unknown, r: any) => (r.fromLocation || r.toLocation ? `${r.fromLocation ?? '?'} → ${r.toLocation ?? '?'}` : '-') },
            { title: 'Số dòng nâng hạ', dataIndex: 'liftingCount', width: 130, align: 'right' as const },
            { title: 'Tổng tiền nâng hạ', dataIndex: 'liftingTotal', width: 140, align: 'right' as const, render: fmtMoney },
          ]}
          locale={{ emptyText: 'Không có phiếu' }}
        />
      </Card>
    </div>
  );
}
