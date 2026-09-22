'use client';

import { useCallback, useEffect, useState } from 'react';
import { App, Button, Empty, Input, Popconfirm, Space, Table, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { apiFetch } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import CarrierFormModal from '@/components/CarrierFormModal';

interface Carrier {
  id: number;
  carrierName: string;
  companyName: string;
  contactPerson: string | null;
  taxCode: string | null;
  phone: string | null;
  fax: string | null;
  address: string | null;
}

interface ListResponse {
  items: Carrier[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function CarriersPage() {
  const { message } = App.useApp();
  const canView = usePermission('carrier', 'view');
  const canCreate = usePermission('carrier', 'create');
  const canEdit = usePermission('carrier', 'edit');
  const canDelete = usePermission('carrier', 'delete');
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(
    async (kw = '', pg = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(pg) });
        if (kw) params.set('search', kw);
        const res = await apiFetch<ListResponse>(`/carriers?${params}`);
        setData(res);
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Không tải được danh sách hãng tàu');
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
    load(search, 1);
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

  // Xóa hãng tàu
  async function handleDelete(id: number) {
    try {
      await apiFetch(`/carriers/${id}`, { method: 'DELETE' });
      message.success('Đã xóa hãng tàu');
      load(search, page);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Hãng tàu
          </Typography.Title>
          <Typography.Text type="secondary">Danh sách hãng tàu đối tác</Typography.Text>
        </div>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} block className="sm:!w-auto">
            Thêm hãng tàu
          </Button>
        )}
      </div>

      {!canView ? (
        <Empty description="Bạn không có quyền xem hãng tàu" />
      ) : (
        <>
          <Input.Search
            placeholder="Tìm theo tên, đơn vị, điện thoại, mã số thuế..."
            allowClear
            enterButton={<SearchOutlined />}
            style={{ width: '100%', maxWidth: 420, marginBottom: 16 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={handleSearch}
          />

          <Table<Carrier>
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
              { title: 'Tên hãng tàu', dataIndex: 'carrierName', render: (v: string) => <span className="font-medium">{v}</span> },
              { title: 'Tên đơn vị', dataIndex: 'companyName' },
              { title: 'Người liên hệ', dataIndex: 'contactPerson', render: (v: string | null) => v ?? '-' },
              {
                title: 'Điện thoại',
                key: 'phone',
                render: (_: unknown, c: Carrier) => (
                  <div>
                    <div>{c.phone ?? '-'}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>{c.fax ?? ''}</div>
                  </div>
                ),
              },
              { title: 'Mã số thuế', dataIndex: 'taxCode', render: (v: string | null) => v ?? '-' },
              {
                title: 'Thao tác',
                key: 'actions',
                width: 120,
                render: (_: unknown, c: Carrier) => (
                  <Space>
                    {canEdit && (
                      <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(c.id)}>
                        Sửa
                      </Button>
                    )}
                    {canDelete && (
                      <Popconfirm title="Xóa hãng tàu này?" onConfirm={() => handleDelete(c.id)} okText="Xóa" cancelText="Hủy">
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

      <CarrierFormModal
        open={modalOpen}
        editingId={editingId}
        onClose={() => setModalOpen(false)}
        onSaved={() => load(search, page)}
      />
    </div>
  );
}