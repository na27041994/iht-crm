'use client';

import { useCallback, useEffect, useState } from 'react';
import { App, DatePicker, Select, Table, Tag, Tooltip, Typography } from 'antd';
import { apiFetch } from '@/lib/api';

interface AuditLog {
  id: number;
  userId: number | null;
  userEmail: string | null;
  userName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  entityCode: string | null;
  description: string | null;
  method: string;
  path: string;
  statusCode: number;
  ip: string | null;
  userAgent: string | null;
  bodyJson: string | null;
  createdAt: string;
}

interface ListResponse {
  items: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface UserOption {
  id: number;
  email: string;
  fullName: string;
}

const ACTION_META: Record<string, { label: string; color: string }> = {
  CREATE: { label: 'Tạo', color: 'green' },
  UPDATE: { label: 'Cập nhật', color: 'blue' },
  DELETE: { label: 'Xóa', color: 'red' },
  LOGIN: { label: 'Đăng nhập', color: 'purple' },
  LOGIN_FAILED: { label: 'Đăng nhập thất bại', color: 'volcano' },
  LOGOUT: { label: 'Đăng xuất', color: 'default' },
  EXPORT: { label: 'Xuất dữ liệu', color: 'cyan' },
};

const ENTITY_LABELS: Record<string, string> = {
  auth: 'Xác thực',
  users: 'Nhân viên',
  customers: 'Khách hàng',
  carriers: 'Hãng tàu',
  truckers: 'Nhà xe',
  agents: 'Đại lý',
  'tracking-sheets': 'Phiếu theo dõi',
  'job-orders': 'Job Order',
  'job-bookings': 'Job Book tàu',
  'debit-notes': 'Debit Note',
  'advance-vouchers': 'Phiếu tạm ứng',
  items: 'Chi tiết phiếu tạm ứng',
  reports: 'Báo cáo',
  upload: 'Tệp đính kèm',
};

// Định dạng ngày YYYY/MM/DD
function fmtDateTime(v: string) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('vi-VN');
}

export default function AuditLogsPage() {
  const { message } = App.useApp();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userId, setUserId] = useState<number | undefined>();
  const [action, setAction] = useState<string | undefined>();
  const [entity, setEntity] = useState<string | undefined>();
  const [range, setRange] = useState<[string, string] | null>(null);

  useEffect(() => {
    apiFetch<UserOption[]>('/auth/users')
      .then(setUsers)
      .catch(() => {});
  }, []);

  const load = useCallback(
    async (
      pg = 1,
      f?: { userId?: number; action?: string; entity?: string; from?: string; to?: string },
    ) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(pg), pageSize: '20' });
        if (f?.userId) params.set('userId', String(f.userId));
        if (f?.action) params.set('action', f.action);
        if (f?.entity) params.set('entity', f.entity);
        if (f?.from) params.set('from', f.from);
        if (f?.to) params.set('to', f.to);
        const res = await apiFetch<ListResponse>(`/audit-logs?${params}`);
        setData(res);
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Không tải được nhật ký');
      } finally {
        setLoading(false);
      }
    },
    [message],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Hàm applyFilters: xử lý applyFilters
  function applyFilters() {
    setPage(1);
    load(1, {
      userId,
      action,
      entity,
      from: range?.[0],
      to: range?.[1],
    });
  }

  return (
    <div>
      <div className="mb-4">
        <Typography.Title level={3} style={{ margin: 0 }}>
          Nhật ký hệ thống
        </Typography.Title>
        <Typography.Text type="secondary">Lịch sử mọi thao tác trên hệ thống</Typography.Text>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Select
          placeholder="Người dùng"
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: 200 }}
          value={userId}
          onChange={(v) => setUserId(v)}
          options={users.map((u) => ({ value: u.id, label: `${u.fullName} (${u.email})` }))}
        />
        <Select
          placeholder="Hành động"
          allowClear
          style={{ width: 170 }}
          value={action}
          onChange={(v) => setAction(v)}
          options={Object.entries(ACTION_META).map(([value, m]) => ({ value, label: m.label }))}
        />
        <Select
          placeholder="Đối tượng"
          allowClear
          style={{ width: 180 }}
          value={entity}
          onChange={(v) => setEntity(v)}
          options={Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <DatePicker.RangePicker
          onChange={(_, strs) => setRange(strs[0] && strs[1] ? [strs[0], strs[1]] : null)} format="DD/MM/YYYY"
        />
        <button
          type="button"
          onClick={applyFilters}
          className="rounded border border-gray-300 bg-white px-4 text-sm hover:border-blue-500 hover:text-blue-600"
        >
          Lọc
        </button>
      </div>

      <Table<AuditLog>
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={data?.items ?? []}
        pagination={{
          current: data?.page ?? 1,
          pageSize: data?.pageSize ?? 20,
          total: data?.total ?? 0,
          showSizeChanger: false,
          showTotal: (t) => `${t} bản ghi`,
          onChange: (p) => {
            setPage(p);
            load(p, { userId, action, entity, from: range?.[0], to: range?.[1] });
          },
        }}
        expandable={{
          expandedRowRender: (log) => (
            <div className="space-y-2 text-xs">
              <div>
                <span className="font-medium">Đường dẫn: </span>
                <Typography.Text code>{log.method} {log.path}</Typography.Text>
              </div>
              {log.bodyJson && (
                <div>
                  <div className="mb-1 font-medium">Dữ liệu:</div>
                  <pre className="overflow-auto rounded bg-gray-50 p-2" style={{ maxHeight: 240 }}>
                    {JSON.stringify(JSON.parse(log.bodyJson), null, 2)}
                  </pre>
                </div>
              )}
              {log.userAgent && (
                <div>
                  <span className="font-medium">User-Agent: </span>
                  {log.userAgent}
                </div>
              )}
            </div>
          ),
          rowExpandable: (log) => Boolean(log.bodyJson || log.userAgent),
        }}
        columns={[
          { title: 'Thời gian', dataIndex: 'createdAt', width: 160, render: fmtDateTime },
          {
            title: 'Người dùng',
            key: 'user',
            render: (_: unknown, log: AuditLog) =>
              log.userName || log.userEmail ? (
                <div>
                  <div className="font-medium">{log.userName ?? '-'}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{log.userEmail ?? ''}</div>
                </div>
              ) : (
                <Tag>Ẩn danh</Tag>
              ),
          },
          {
            title: 'Hành động',
            dataIndex: 'action',
            width: 140,
            render: (v: string) => {
              const meta = ACTION_META[v] ?? { label: v, color: 'default' };
              return <Tag color={meta.color}>{meta.label}</Tag>;
            },
          },
          {
            title: 'Đối tượng',
            key: 'target',
            render: (_: unknown, log: AuditLog) => (
              <span>
                {ENTITY_LABELS[log.entity] ?? log.entity}
                {log.entityCode && (
                  <Tag color="geekblue" style={{ marginLeft: 6 }}>
                    {log.entityCode}
                  </Tag>
                )}
                {log.entityId ? (
                  <Typography.Text code style={{ marginLeft: log.entityCode ? 0 : 6 }}>
                    #{log.entityId}
                  </Typography.Text>
                ) : null}
              </span>
            ),
          },
          {
            title: 'Nội dung',
            dataIndex: 'description',
            ellipsis: { showTitle: false },
            render: (v: string | null, log: AuditLog) => {
              const text = v ?? `${log.method} ${log.path}`;
              return (
                <Tooltip title={text}>
                  <span>{v ? text : <Typography.Text code style={{ fontSize: 12 }}>{text}</Typography.Text>}</span>
                </Tooltip>
              );
            },
          },
          { title: 'IP', dataIndex: 'ip', width: 130, render: (v: string | null) => v ?? '-' },
          {
            title: 'Kết quả',
            dataIndex: 'statusCode',
            width: 90,
            align: 'center',
            render: (v: number) => <Tag color={v < 400 ? 'green' : 'red'}>{v}</Tag>,
          },
        ]}
      />
    </div>
  );
}