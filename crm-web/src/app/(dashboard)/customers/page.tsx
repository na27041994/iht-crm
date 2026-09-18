'use client';

import { useCallback, useEffect, useState } from 'react';
import { App, Button, Empty, Input, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import CustomerFormModal from '@/components/CustomerFormModal';

interface Customer {
  id: number;
  customerType: string;
  code: string | null;
  customerName: string;
  companyName: string;
  contactPerson: string | null;
  taxCode: string | null;
  email: string | null;
  phone: string | null;
  fax: string | null;
  country: string | null;
  _count: { orders: number; trackingSheets: number };
}

interface ListResponse {
  items: Customer[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function CustomersPage() {
  const { message } = App.useApp();
  const canView = usePermission('customer', 'view');
  const canCreate = usePermission('customer', 'create');
  const canEdit = usePermission('customer', 'edit');
  const canDelete = usePermission('customer', 'delete');
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(
    async (kw = '', pg = 1, tp?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(pg) });
        if (kw) params.set('search', kw);
        if (tp) params.set('customerType', tp);
        const res = await apiFetch<ListResponse>(`/customers?${params}`);
        setData(res);
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Không tải được danh sách khách hàng');
      } finally {
        setLoading(false);
      }
    },
    [message],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Hàm handleSearch: xử lý handleSearch
  function handleSearch() {
    setPage(1);
    load(search, 1, typeFilter);
  }

  // Hàm openCreate: xử lý openCreate
  function openCreate() {
    setEditingId(null);
    setModalOpen(true);
  }

  // Hàm openEdit: xử lý openEdit
  function openEdit(id: number) {
    setEditingId(id);
    setModalOpen(true);
  }

  // Xóa khách hàng (kiểm quyền delete)
  async function handleDelete(id: number) {
    try {
      await apiFetch(`/customers/${id}`, { method: 'DELETE' });
      message.success('Đã xóa khách hàng');
      load(search, page, typeFilter);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Khách hàng
          </Typography.Title>
          <Typography.Text type="secondary">Danh sách khách hàng của công ty</Typography.Text>
        </div>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} block className="sm:!w-auto">
            Thêm khách hàng
          </Button>
        )}
      </div>

      {!canView ? (
        <Empty description="Bạn không có quyền xem khách hàng" />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <Input.Search
              placeholder="Tìm theo mã, tên, email, số điện thoại..."
              allowClear
              enterButton={<SearchOutlined />}
              style={{ width: '100%', maxWidth: 420 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onSearch={handleSearch}
            />
            <Select
              placeholder="Phân loại"
              allowClear
              style={{ width: 140 }}
              value={typeFilter}
              onChange={(v) => {
                setTypeFilter(v);
                setPage(1);
                load(search, 1, v);
              }}
              options={[
                { value: 'KH', label: 'KH' },
                { value: 'DL', label: 'DL' },
              ]}
            />
          </div>

          <Table<Customer>
            size="small"
            rowKey="id"
            loading={loading}
            dataSource={data?.items ?? []}
            pagination={{
              current: data?.page ?? 1,
              pageSize: data?.pageSize ?? 20,
              total: data?.total ?? 0,
              showSizeChanger: false,
              onChange: (p) => {
                setPage(p);
                load(search, p);
              },
            }}
            scroll={{ x: 900 }}
            columns={[
              {
                title: 'Mã KH',
                dataIndex: 'code',
                width: 110,
                render: (v: string | null) => <span style={{ fontWeight: 600 }}>{v ?? '-'}</span>,
              },
              {
                title: 'Loại',
                dataIndex: 'customerType',
                width: 70,
                align: 'center' as const,
                render: (v: string) => <Tag color={v === 'DL' ? 'purple' : 'blue'}>{v ?? 'KH'}</Tag>,
              },
              {
                title: 'Tên khách hàng',
                dataIndex: 'customerName',
                render: (v: string, c: Customer) => (
                  <Link href={`/customers/${c.id}`} className="font-medium text-blue-600 hover:underline">
                    {v}
                  </Link>
                ),
              },
              { title: 'Tên đơn vị', dataIndex: 'companyName' },
              { title: 'Người liên hệ', dataIndex: 'contactPerson', render: (v: string | null) => v ?? '-' },
              {
                title: 'Điện thoại',
                key: 'phone',
                render: (_: unknown, c: Customer) => (
                  <div>
                    <div>{c.phone ?? '-'}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>{c.email ?? ''}</div>
                  </div>
                ),
              },
              { title: 'Fax', dataIndex: 'fax', render: (v: string | null) => v ?? '-' },
              { title: 'Mã số thuế', dataIndex: 'taxCode', render: (v: string | null) => v ?? '-' },
              {
                title: 'Đơn hàng',
                key: 'orders',
                align: 'center' as const,
                render: (_: unknown, c: Customer) => c._count.orders,
              },
              {
                title: 'Phiếu theo dõi',
                key: 'trackingSheets',
                align: 'center' as const,
                render: (_: unknown, c: Customer) => c._count.trackingSheets,
              },
              {
                title: 'Thao tác',
                key: 'actions',
                width: 120,
                render: (_: unknown, c: Customer) => (
                  <Space>
                    {canEdit && (
                      <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(c.id)}>
                        Sửa
                      </Button>
                    )}
                    {canDelete && (
                      <Popconfirm title="Xóa khách hàng này?" onConfirm={() => handleDelete(c.id)} okText="Xóa" cancelText="Hủy">
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        </>
      )}

      <CustomerFormModal
        open={modalOpen}
        editingId={editingId}
        onClose={() => setModalOpen(false)}
        onSaved={() => load(search, page, typeFilter)}
      />
    </div>
  );
}