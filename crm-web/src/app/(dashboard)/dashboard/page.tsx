'use client';

import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Table, Typography } from 'antd';
import { TeamOutlined, FileSearchOutlined, CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface DashboardStats {
  totalCustomers: number;
  totalTrackingSheets: number;
  todaySheets: number;
  monthSheets: number;
  yearSheets: number;
  recentTrackingSheets: Array<{
    id: number;
    sheetNumber: string;
    fromLocation: string | null;
    toLocation: string | null;
    customer: { companyName: string } | null;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    apiFetch<DashboardStats>('/reports/dashboard')
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  // Hàm fmt: xử lý fmt
  const fmt = (v: number | undefined) => v?.toLocaleString('vi-VN') ?? '0';

  return (
    <div>
      <Typography.Title level={3} style={{ marginBottom: 16 }}>
        Tổng quan
      </Typography.Title>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6} lg={3}>
          <Card>
            <Statistic title="Khách hàng" value={fmt(stats?.totalCustomers)} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <Card>
            <Statistic title="Tổng phiếu theo dõi" value={fmt(stats?.totalTrackingSheets)} prefix={<FileSearchOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <Card>
            <Statistic title="Phiếu hôm nay" value={fmt(stats?.todaySheets)} prefix={<CalendarOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <Card>
            <Statistic title="Phiếu tháng này" value={fmt(stats?.monthSheets)} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <Card>
            <Statistic title="Phiếu năm nay" value={fmt(stats?.yearSheets)} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card title="Phiếu theo dõi gần đây">
        <Table
          size="small"
          rowKey="id"
          dataSource={stats?.recentTrackingSheets ?? []}
          pagination={false}
          locale={{ emptyText: 'Chưa có dữ liệu' }}
          columns={[
            {
              title: 'Mã phiếu',
              dataIndex: 'sheetNumber',
              render: (v: string, s: DashboardStats['recentTrackingSheets'][number]) => (
                <Link href={`/tracking-sheets/${s.id}`} className="font-medium text-blue-600 hover:underline">
                  <Typography.Text code>{v}</Typography.Text>
                </Link>
              ),
            },
            {
              title: 'Khách hàng',
              render: (_: unknown, s: DashboardStats['recentTrackingSheets'][number]) => s.customer?.companyName ?? '-',
            },
            { title: 'Tuyến', render: (_: unknown, s: DashboardStats['recentTrackingSheets'][number]) => (s.fromLocation || s.toLocation ? `${s.fromLocation ?? ''} → ${s.toLocation ?? ''}` : '-') },
          ]}
        />
      </Card>
    </div>
  );
}