'use client';
const MONEY_SCALE = 100;

import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, DatePicker, Select, Space, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { apiDownload, apiFetch, saveBlob } from '@/lib/api';

interface RefundItem {
  sheetId: number;
  sheetNumber: string;
  source: 'booking' | 'order';
  rowId: number;
  type: string;
  description: string | null;
  amount: number;
  date: string;
  customerId: number | null;
  customerName: string;
  carrierId: number | null;
  carrierName: string | null;
  agentId: number | null;
  agentName: string | null;
}

interface RefundGroup {
  id: string | number | null;
  name: string;
  rowCount: number;
  sheetCount: number;
  totalAmount: number;
}

interface RefundReport {
  from: string | null;
  to: string | null;
  totalAmount: number;
  rowCount: number;
  customers: RefundGroup[];
  types: RefundGroup[];
  carriers: RefundGroup[];
  agents: RefundGroup[];
}

// Định dạng số tiền/số lượng theo chuẩn vi-VN
const fmtMoney = (v: string | number | null | undefined) =>
  v == null ? '-' : (Number(v) / MONEY_SCALE).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

// Định dạng ngày YYYY/MM/DD
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

const SOURCE_LABEL: Record<string, string> = { booking: 'Job Book tàu', order: 'Job Order' };

type RefundDim = 'customer' | 'type';

// Hàm DetailTable: xử lý DetailTable
function DetailTable({ dim, groupId, from, to, typeFilter }: { dim: RefundDim; groupId: string | number | null; from?: string; to?: string; typeFilter?: string }) {
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [rows, setRows] = useState<RefundItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ dim, page: String(page), pageSize: String(pageSize) });
    params.set('id', groupId == null ? 'none' : String(groupId));
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (typeFilter) params.set('type', typeFilter);
    apiFetch<{ rows: RefundItem[]; total: number }>(`/reports/refund/items?${params.toString()}`)
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
  }, [dim, groupId, from, to, typeFilter, page]);

  return (
    <Table<RefundItem>
      rowKey={(r) => `${r.source}-${r.rowId}`}
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
        { title: 'Phiếu', dataIndex: 'sheetNumber', width: 140 },
        { title: 'Nguồn', dataIndex: 'source', width: 120, render: (v: string) => <Tag>{SOURCE_LABEL[v] ?? v}</Tag> },
        { title: 'Loại', dataIndex: 'type', width: 160, render: (v: string) => <Tag color="orange">{v}</Tag> },
        { title: 'Mô tả', dataIndex: 'description', ellipsis: true, render: (v: string | null) => v ?? '-' },
        { title: 'Ngày', dataIndex: 'date', width: 110, render: (v: string) => fmtDate(v) },
        { title: 'Số tiền', dataIndex: 'amount', align: 'right' as const, width: 130, render: (v: number) => fmtMoney(v) },
      ]}
    />
  );
}

// Hàm groupColumns: xử lý groupColumns
function groupColumns(entityLabel: string): ColumnsType<RefundGroup> {
  return [
    {
      title: entityLabel,
      dataIndex: 'name',
      render: (v: string) => <span className="font-medium">{v}</span>,
    },
    { title: 'Số dòng', dataIndex: 'rowCount', align: 'right' as const, width: 100 },
    { title: 'Số phiếu', dataIndex: 'sheetCount', align: 'right' as const, width: 100 },
    {
      title: 'Tổng tiền hoàn',
      dataIndex: 'totalAmount',
      align: 'right' as const,
      width: 180,
      render: (v: number) => <span className="font-semibold">{fmtMoney(v)}</span>,
    },
  ];
}

export default function RefundReportPage() {
  const { message } = App.useApp();
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [data, setData] = useState<RefundReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('customers');
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);

  const REFUND_TYPES = ['Refund khách hàng', 'Refund hãng tàu', 'Refund đại lý'];

  const load = useCallback(async (f?: { from?: string; to?: string; type?: string }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f?.from) params.set('from', f.from);
      if (f?.to) params.set('to', f.to);
      if (f?.type) params.set('type', f.type);
      const qs = params.toString();
      const res = await apiFetch<RefundReport>(`/reports/refund${qs ? `?${qs}` : ''}`);
      setData(res);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không tải được báo cáo');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    load();
  }, [load]);

  // Hàm applyRange: xử lý applyRange
  function applyRange() {
    load({ from: range?.[0].format('YYYY-MM-DD'), to: range?.[1].format('YYYY-MM-DD'), type: typeFilter });
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
      if (typeFilter) params.set('type', typeFilter);
      const qs = params.toString();
      const blob = await apiDownload(`/reports/refund/export${qs ? `?${qs}` : ''}`);
      const parts = ['bao-cao-hoan-phi'];
      if (range) parts.push(range[0].format('YYYYMMDD'), range[1].format('YYYYMMDD'));
      if (typeFilter) parts.push(typeFilter);
      saveBlob(blob, `${parts.join('_')}.xlsx`);
      message.success('Đã xuất Excel');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xuất Excel thất bại');
    } finally {
      setExporting(false);
    }
  }

  const tabs = [
    { key: 'customers', label: 'Khách hàng', entity: 'Khách hàng', groups: data?.customers ?? [] },
    { key: 'types', label: 'Loại', entity: 'Loại', groups: data?.types ?? [] },
  ] as const;

  const rangeParams = range
    ? { from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') }
    : undefined;

  return (
    <div>
      <div className="mb-4">
        <Typography.Title level={3} style={{ margin: 0 }}>
          Báo cáo hoàn phí (Refund)
        </Typography.Title>
        <Typography.Text type="secondary">
          Tổng hợp hoàn phí theo khách hàng và loại — lọc theo ngày ETA phiếu (nếu trống lấy ngày tạo phiếu) và loại refund
        </Typography.Text>
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
          placeholder={['Từ ngày', 'Đến ngày']} format="DD/MM/YYYY"
        />
        <Select
          value={typeFilter}
          onChange={(v) => setTypeFilter(v)}
          style={{ width: 200 }}
          placeholder="Lọc theo loại"
          options={REFUND_TYPES.map((t) => ({ value: t, label: t }))}
          allowClear
        />
        <Space>
          <Button type="primary" onClick={applyRange}>
            Xem báo cáo
          </Button>
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
            Xuất Excel
          </Button>
        </Space>
      </div>

      <Card size="small" className="mb-4">
        <div className="flex flex-wrap gap-8">
          <Statistic title="Tổng tiền hoàn" value={data ? fmtMoney(data.totalAmount) : '-'} />
          <Statistic title="Số dòng refund" value={data?.rowCount ?? '-'} />
        </div>
      </Card>

      <Tabs
        defaultActiveKey="customers"
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabs.map((t) => ({
          key: t.key,
          label: t.label,
          children: (
            <Table<RefundGroup>
              rowKey={(r) => String(r.id ?? 'none')}
              loading={loading}
              dataSource={t.groups}
              columns={groupColumns(t.entity)}
              pagination={false}
              locale={{ emptyText: 'Không có dữ liệu hoàn phí' }}
              expandable={{
                expandedRowRender: (record) => (
                  <DetailTable
                    dim={t.key === 'types' ? 'type' : 'customer'}
                    groupId={record.id}
                    from={rangeParams?.from}
                    to={rangeParams?.to}
                    typeFilter={typeFilter}
                  />
                ),
                rowExpandable: (record) => record.rowCount > 0,
              }}
              summary={(rows) => {
                const total = rows.reduce((s, r) => s + r.totalAmount, 0);
                return rows.length > 0 ? (
                  <Table.Summary.Row className="font-semibold">
                    <Table.Summary.Cell index={0}>Tổng cộng</Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">{rows.reduce((s, r) => s + r.rowCount, 0)}</Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">{rows.reduce((s, r) => s + r.sheetCount, 0)}</Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">{fmtMoney(total)}</Table.Summary.Cell>
                  </Table.Summary.Row>
                ) : null;
              }}
            />
          ),
        }))}
      />
    </div>
  );
}
