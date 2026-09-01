'use client';

import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, DatePicker, Space, Statistic, Table, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { apiDownload, apiFetch, saveBlob } from '@/lib/api';

interface SheetCreationItem {
  sheetId: number;
  sheetNumber: string;
  customerName: string;
  createdAt: string;
  etaDate: string | null;
}

interface SheetCreationGroup {
  id: number | null;
  name: string;
  sheetCount: number;
}

interface SheetCreationReport {
  from: string | null;
  to: string | null;
  totalSheets: number;
  groups: SheetCreationGroup[];
}

// Định dạng ngày YYYY/MM/DD
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Định dạng ngày YYYY/MM/DD
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

// Hàm UserSheetsTable: xử lý UserSheetsTable
function UserSheetsTable({ userId, from, to }: { userId: number | null; from?: string; to?: string }) {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [rows, setRows] = useState<SheetCreationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    params.set('userId', userId == null ? 'none' : String(userId));
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    apiFetch<{ rows: SheetCreationItem[]; total: number }>(`/reports/sheet-creation/items?${params.toString()}`)
      .then((r) => {
        if (!cancelled) {
          setRows(r.rows);
          setTotal(r.total);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, from, to, page]);

  return (
    <Table<SheetCreationItem>
      rowKey="sheetId"
      size="small"
      loading={loading}
      dataSource={rows}
      pagination={{
        current: page,
        pageSize,
        total,
        onChange: setPage,
        size: 'small',
        showSizeChanger: false,
      }}
      columns={[
        { title: 'Mã phiếu', dataIndex: 'sheetNumber', width: 150 },
        { title: 'Khách hàng', dataIndex: 'customerName' },
        { title: 'Ngày tạo', dataIndex: 'createdAt', width: 170, render: (v: string) => fmtDateTime(v) },
        { title: 'Ngày ETA', dataIndex: 'etaDate', width: 120, render: (v: string | null) => (v ? fmtDate(v) : '-') },
      ]}
    />
  );
}

export default function SheetCreationReportPage() {
  const { message } = App.useApp();
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [data, setData] = useState<SheetCreationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (f?: { from?: string; to?: string }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f?.from) params.set('from', f.from);
      if (f?.to) params.set('to', f.to);
      const qs = params.toString();
      const res = await apiFetch<SheetCreationReport>(`/reports/sheet-creation${qs ? `?${qs}` : ''}`);
      setData(res);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không tải được thống kê');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    load();
  }, [load]);

  // Hàm applyRange: xử lý applyRange
  function applyRange() {
    load({ from: range?.[0].format('YYYY-MM-DD'), to: range?.[1].format('YYYY-MM-DD') });
  }

  // Hàm handleExport: xử lý handleExport
  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (range) {
        params.set('from', range[0].format('YYYY-MM-DD'));
        params.set('to', range[1].format('YYYY-MM-DD'));
      }
      const qs = params.toString();
      const blob = await apiDownload(`/reports/sheet-creation/export${qs ? `?${qs}` : ''}`);
      const parts = ['thong-ke-phieu-theo-doi'];
      if (range) parts.push(range[0].format('YYYYMMDD'), range[1].format('YYYYMMDD'));
      saveBlob(blob, `${parts.join('_')}.xlsx`);
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
          Thống kê phiếu theo dõi
        </Typography.Title>
        <Typography.Text type="secondary">Số phiếu đã tạo theo nhân viên tạo phiếu</Typography.Text>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <DatePicker.RangePicker
          value={range}
          onChange={(vals) => {
            if (vals && vals[0] && vals[1]) {
              setRange([dayjs(vals[0]), dayjs(vals[1])]);
            } else {
              setRange(null);
            }
          }}
          allowClear
          placeholder={['Từ ngày', 'Đến ngày']}
        />
        <Space>
          <Button type="primary" onClick={applyRange}>
            Xem thống kê
          </Button>
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
            Xuất Excel
          </Button>
        </Space>
      </div>

      <Card size="small" className="mb-4">
        <Statistic title="Tổng số phiếu" value={data?.totalSheets ?? '-'} />
      </Card>

      <Table<SheetCreationGroup>
        rowKey={(r) => String(r.id ?? 'none')}
        loading={loading}
        dataSource={data?.groups ?? []}
        pagination={false}
        locale={{ emptyText: 'Không có dữ liệu' }}
        columns={[
          {
            title: 'Nhân viên tạo',
            dataIndex: 'name',
            render: (v: string) => <span className="font-medium">{v}</span>,
          },
          {
            title: 'Số phiếu đã tạo',
            dataIndex: 'sheetCount',
            align: 'right' as const,
            width: 160,
            render: (v: number) => <span className="font-semibold">{v}</span>,
          },
        ]}
        expandable={{
          expandedRowRender: (record) => (
            <UserSheetsTable
              userId={record.id}
              from={range?.[0].format('YYYY-MM-DD')}
              to={range?.[1].format('YYYY-MM-DD')}
            />
          ),
          rowExpandable: (record) => record.sheetCount > 0,
        }}
        summary={(rows) => {
          const total = rows.reduce((s, r) => s + r.sheetCount, 0);
          return rows.length > 0 ? (
            <Table.Summary.Row className="font-semibold">
              <Table.Summary.Cell index={0}>Tổng cộng</Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">{total}</Table.Summary.Cell>
            </Table.Summary.Row>
          ) : null;
        }}
      />
    </div>
  );
}
