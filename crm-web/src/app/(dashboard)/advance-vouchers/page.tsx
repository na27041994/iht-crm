'use client';

import { useCallback, useEffect, useState } from 'react';
import { App, Button, Input, Popconfirm, Table, Tag, Typography } from 'antd';
import { EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import AdvanceVoucherFormModal from '@/components/AdvanceVoucherFormModal';

interface AdvanceVoucher {
  id: number;
  advanceNo: string;
  type: string;
  advanceDate: string;
  currency: string;
  sheet: { id: number; sheetNumber: string } | null;
  customer: { id: number; companyName: string } | null;
  createdBy: { id: number; fullName: string } | null;
  totalAmount: number;
}

interface ListResponse {
  items: AdvanceVoucher[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const MONEY_SCALE = 100;
function fmtMoney(v: number | null | undefined) {
  if (v == null) return '-';
  return new Intl.NumberFormat('vi-VN').format(v / MONEY_SCALE);
}

export default function AdvanceVouchersPage() {
  const { message } = App.useApp();
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
        const res = await apiFetch<ListResponse>(`/advance-vouchers?${params}`);
        setData(res);
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Không tải được danh sách phiếu');
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

  // Hàm handleDelete: xử lý handleDelete
  async function handleDelete(id: number) {
    try {
      await apiFetch(`/advance-vouchers/${id}`, { method: 'DELETE' });
      message.success('Đã xóa phiếu chi tạm ứng');
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
            Phiếu chi tạm ứng
          </Typography.Title>
          <Typography.Text type="secondary">Quản lý các khoản chi tạm ứng theo job</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} block className="sm:!w-auto">
          Thêm phiếu
        </Button>
      </div>

      <Input.Search
        placeholder="Tìm theo Advance No, khách hàng, job..."
        allowClear
        enterButton={<SearchOutlined />}
        style={{ width: '100%', maxWidth: 420, marginBottom: 16 }}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onSearch={handleSearch}
      />

      <Table<AdvanceVoucher>
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
        scroll={{ x: 1000 }}
        columns={[
          {
            title: 'Advance No',
            dataIndex: 'advanceNo',
            render: (v: string, r: AdvanceVoucher) => (
              <Link href={`/advance-vouchers/${r.id}`} className="font-medium text-blue-600 hover:underline">
                <Typography.Text code>{v}</Typography.Text>
              </Link>
            ),
          },
          { title: 'Loại', dataIndex: 'type', render: (v: string) => <Tag color="blue">{v}</Tag> },
          {
            title: 'Ngày tạo',
            dataIndex: 'advanceDate',
            render: (v: string) => new Date(v).toLocaleDateString('vi-VN'),
          },
          { title: 'Nhân viên tạo', render: (_: unknown, r: AdvanceVoucher) => r.createdBy?.fullName ?? '-' },
          { title: 'Job', render: (_: unknown, r: AdvanceVoucher) => r.sheet?.sheetNumber ?? '-' },
          {
            title: 'Khách hàng',
            render: (_: unknown, r: AdvanceVoucher) => r.customer?.companyName ?? '-',
          },
          {
            title: 'Current',
            dataIndex: 'currency',
            align: 'center' as const,
            render: (v: string) => <Tag color={v === 'USD' ? 'green' : 'default'}>{v}</Tag>,
          },
          {
            title: 'Tổng tiền',
            align: 'right' as const,
            render: (_: unknown, r: AdvanceVoucher) => <span className="font-medium">{fmtMoney(r.totalAmount)}</span>,
          },
          {
            title: 'Thao tác',
            key: 'actions',
            width: 110,
            render: (_: unknown, r: AdvanceVoucher) => (
              <div className="flex gap-1">
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r.id)} />
                <Popconfirm title="Xóa phiếu này?" onConfirm={() => handleDelete(r.id)} okText="Xóa" cancelText="Hủy">
                  <Button size="small" danger>
                    Xóa
                  </Button>
                </Popconfirm>
              </div>
            ),
          },
        ]}
      />

      <AdvanceVoucherFormModal
        open={modalOpen}
        editingId={editingId}
        onClose={() => setModalOpen(false)}
        onSaved={() => load(search, page)}
      />
    </div>
  );
}