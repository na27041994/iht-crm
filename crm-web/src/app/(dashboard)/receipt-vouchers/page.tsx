'use client';

import { useCallback, useEffect, useState } from 'react';
import { App, Button, Input, Popconfirm, Select, Table, Tag, Typography } from 'antd';
import { EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { apiFetch, apiDownload } from '@/lib/api';
import ReceiptVoucherFormModal, { RECEIPT_PAYER_TYPES } from '@/components/ReceiptVoucherFormModal';

interface ReceiptVoucher {
  id: number;
  receiptNo: string;
  payerType: string;
  receiptDate: string;
  currency: string;
  customer: { id: number; companyName: string } | null;
  payerDisplay: string;
  createdBy: { id: number; fullName: string } | null;
  staff: { id: number; fullName: string } | null;
  amount: number | string;
  transFee: number | string;
}

interface ListResponse {
  items: ReceiptVoucher[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const MONEY_SCALE = 100;
function fmtMoney(v: number | string | null | undefined) {
  if (v == null || v === '') return '-';
  const n = Number(v);
  if (Number.isNaN(n)) return '-';
  return new Intl.NumberFormat('vi-VN').format(n / MONEY_SCALE);
}

export default function ReceiptVouchersPage() {
  const { message } = App.useApp();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [payerType, setPayerType] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(
    async (kw = '', pt: string | undefined = undefined, pg = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(pg) });
        if (kw) params.set('search', kw);
        if (pt) params.set('payerType', pt);
        const res = await apiFetch<ListResponse>(`/receipt-vouchers?${params}`);
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
    load(search, payerType, 1);
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
      await apiFetch(`/receipt-vouchers/${id}`, { method: 'DELETE' });
      message.success('Đã xóa phiếu thu');
      load(search, payerType, page);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  }

  // Hàm handleExport: xử lý handleExport
  async function handleExport() {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (payerType) params.set('payerType', payerType);
      const blob = await apiDownload(`/receipt-vouchers/export?${params}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'phieu-thu.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xuất Excel thất bại');
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Phiếu thu
          </Typography.Title>
          <Typography.Text type="secondary">Quản lý các khoản thu từ khách hàng / cá nhân</Typography.Text>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} block className="sm:!w-auto">
            Xuất Excel
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} block className="sm:!w-auto">
            Thêm phiếu
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row" style={{ maxWidth: 640 }}>
        <Input.Search
          placeholder="Tìm theo Receipt No, người nộp, lý do..."
          allowClear
          enterButton={<SearchOutlined />}
          style={{ width: '100%', maxWidth: 420 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={handleSearch}
        />
        <Select
          placeholder="Đối tượng"
          allowClear
          style={{ width: '100%', maxWidth: 200 }}
          value={payerType}
          onChange={(v) => {
            setPayerType(v);
            setPage(1);
            load(search, v, 1);
          }}
          options={RECEIPT_PAYER_TYPES.map((t) => ({ value: t, label: t }))}
        />
      </div>

      <Table<ReceiptVoucher>
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
            load(search, payerType, p);
          },
        }}
        scroll={{ x: 1000 }}
        columns={[
          {
            title: 'Receipt No',
            dataIndex: 'receiptNo',
            render: (v: string, r: ReceiptVoucher) => (
              <Link href={`/receipt-vouchers/${r.id}`} className="font-medium text-blue-600 hover:underline">
                <Typography.Text code>{v}</Typography.Text>
              </Link>
            ),
          },
          { title: 'Đối tượng', dataIndex: 'payerType', render: (v: string) => <Tag color="blue">{v}</Tag> },
          {
            title: 'Ngày thu',
            dataIndex: 'receiptDate',
            render: (v: string) => new Date(v).toLocaleDateString('vi-VN'),
          },
          { title: 'Người nộp', render: (_: unknown, r: ReceiptVoucher) => r.payerDisplay || '-' },
          { title: 'NV thu', render: (_: unknown, r: ReceiptVoucher) => r.staff?.fullName ?? r.createdBy?.fullName ?? '-' },
          {
            title: 'Current',
            dataIndex: 'currency',
            align: 'center' as const,
            render: (v: string) => <Tag color={v === 'USD' ? 'green' : 'default'}>{v}</Tag>,
          },
          {
            title: 'Số tiền',
            align: 'right' as const,
            render: (_: unknown, r: ReceiptVoucher) => <span className="font-medium">{fmtMoney(r.amount)}</span>,
          },
          {
            title: 'Thao tác',
            key: 'actions',
            width: 110,
            render: (_: unknown, r: ReceiptVoucher) => (
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

      <ReceiptVoucherFormModal
        open={modalOpen}
        editingId={editingId}
        onClose={() => setModalOpen(false)}
        onSaved={() => load(search, payerType, page)}
      />
    </div>
  );
}
