'use client';
const MONEY_SCALE = 100;

import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, DatePicker, Space, Statistic, Table, Typography } from 'antd';
import { DownloadOutlined, PrinterOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { apiDownload, apiFetch, saveBlob } from '@/lib/api';

interface ProfitRow {
  sheetId: number;
  sheetNumber: string;
  customerName: string;
  revenue: number;
  totalFees: number;
  cuocFees: number;
  serviceFees: number;
  profit: number;
  date: string;
}

interface ProfitReport {
  from: string | null;
  to: string | null;
  items: ProfitRow[];
  totalSheets: number;
  totalRevenue: number;
  totalServiceFees: number;
  totalCuocFees: number;
  totalProfit: number;
}

// Định dạng số tiền/số lượng theo chuẩn vi-VN
const fmtMoney = (v: string | number | null | undefined) =>
  v == null ? '-' : (Number(v) / MONEY_SCALE).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

// Định dạng ngày YYYY/MM/DD
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function ProfitReportPage() {
  const { message } = App.useApp();
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [data, setData] = useState<ProfitReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (f?: { from?: string; to?: string }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f?.from) params.set('from', f.from);
      if (f?.to) params.set('to', f.to);
      const qs = params.toString();
      const res = await apiFetch<ProfitReport>(`/reports/profit${qs ? `?${qs}` : ''}`);
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

  // Hàm applyFilter: xử lý applyFilter
  function applyFilter() {
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
      const blob = await apiDownload(`/reports/profit/export${qs ? `?${qs}` : ''}`);
      const parts = ['bao-cao-loi-nhuan'];
      if (range) parts.push(range[0].format('YYYYMMDD'), range[1].format('YYYYMMDD'));
      saveBlob(blob, `${parts.join('_')}.xlsx`);
      message.success('Đã xuất Excel');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xuất Excel thất bại');
    } finally {
      setExporting(false);
    }
  }

  // Hàm handlePrint: xử lý handlePrint
  function handlePrint() {
    window.print();
  }

  const columns: ColumnsType<ProfitRow> = [
    { title: 'Mã phiếu', dataIndex: 'sheetNumber', width: 140, render: (v: string) => <span className="font-medium">{v}</span> },
    { title: 'Khách hàng', dataIndex: 'customerName', width: 200 },
    { title: 'Ngày', dataIndex: 'date', width: 110, render: (v: string) => fmtDate(v) },
    {
      title: 'Doanh thu (Debit)',
      dataIndex: 'revenue',
      width: 160,
      align: 'right' as const,
      render: (v: number) => <span className="text-blue-600">{fmtMoney(v)}</span>,
    },
    {
      title: 'Tổng phí (chưa thuế)',
      dataIndex: 'totalFees',
      width: 160,
      align: 'right' as const,
      render: (v: number) => fmtMoney(v),
    },
    {
      title: 'Cược (Cont + sửa chữa)',
      dataIndex: 'cuocFees',
      width: 160,
      align: 'right' as const,
      render: (v: number) => <span className="text-orange-500">{fmtMoney(v)}</span>,
    },
    {
      title: 'Phí dịch vụ',
      dataIndex: 'serviceFees',
      width: 150,
      align: 'right' as const,
      render: (v: number) => <span className="text-red-500">{fmtMoney(v)}</span>,
    },
    {
      title: 'Lợi nhuận',
      dataIndex: 'profit',
      width: 150,
      align: 'right' as const,
      render: (v: number) => (
        <span className={v >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
          {fmtMoney(v)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4">
        <Typography.Title level={3} style={{ margin: 0 }}>
          Báo cáo lợi nhuận
        </Typography.Title>
        <Typography.Text type="secondary">
          Doanh thu (Debit Note) − Phí dịch vụ (Tổng phí chưa thuế − Cược) = Lợi nhuận
        </Typography.Text>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
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
        <Space>
          <Button type="primary" icon={<SearchOutlined />} onClick={applyFilter}>
            Xem báo cáo
          </Button>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>
            In
          </Button>
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
            Xuất Excel
          </Button>
        </Space>
      </div>

      {data && (
        <Card size="small" className="mb-4">
          <div className="flex flex-wrap gap-8">
            <Statistic title="Tổng doanh thu" value={fmtMoney(data.totalRevenue)} prefix={<span className="text-blue-600">▲</span>} />
            <Statistic title="Tổng phí (chưa thuế)" value={fmtMoney(data.totalServiceFees + data.totalCuocFees)} />
            <Statistic title="Cược" value={fmtMoney(data.totalCuocFees)} prefix={<span className="text-orange-500">◆</span>} />
            <Statistic title="Phí dịch vụ" value={fmtMoney(data.totalServiceFees)} prefix={<span className="text-red-500">▼</span>} />
            <Statistic
              title="Lợi nhuận"
              value={fmtMoney(data.totalProfit)}
              prefix={<span className={data.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>{data.totalProfit >= 0 ? '▲' : '▼'}</span>}
              valueStyle={{ color: data.totalProfit >= 0 ? '#16a34a' : '#dc2626' }}
            />
            <Statistic title="Số phiếu" value={data.totalSheets} />
          </div>
        </Card>
      )}

      <Table<ProfitRow>
        rowKey="sheetId"
        loading={loading}
        dataSource={data?.items ?? []}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} phiếu` }}
        scroll={{ x: 1200 }}
        columns={columns}
        locale={{ emptyText: 'Không có dữ liệu' }}
        summary={(rows) => {
          if (!rows.length) return null;
          const rev = rows.reduce((s, r) => s + r.revenue, 0);
          const fees = rows.reduce((s, r) => s + r.totalFees, 0);
          const cuoc = rows.reduce((s, r) => s + r.cuocFees, 0);
          const svc = rows.reduce((s, r) => s + r.serviceFees, 0);
          const profit = rows.reduce((s, r) => s + r.profit, 0);
          return (
            <Table.Summary.Row className="font-bold">
              <Table.Summary.Cell index={0} colSpan={3}>Tổng cộng</Table.Summary.Cell>
              <Table.Summary.Cell index={3} />
              <Table.Summary.Cell index={4} align="right">{fmtMoney(rev)}</Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">{fmtMoney(fees)}</Table.Summary.Cell>
              <Table.Summary.Cell index={6} align="right">{fmtMoney(cuoc)}</Table.Summary.Cell>
              <Table.Summary.Cell index={7} align="right">{fmtMoney(svc)}</Table.Summary.Cell>
              <Table.Summary.Cell index={8} align="right">
                <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>{fmtMoney(profit)}</span>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          );
        }}
      />
    </div>
  );
}
