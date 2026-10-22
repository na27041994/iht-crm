'use client';

import { useCallback, useEffect, useState } from 'react';
import { App, Button, Input, Popconfirm, Table, Tabs, Tag, Tooltip, Typography } from 'antd';
import { EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermission';
import AdvanceVoucherFormModal from '@/components/AdvanceVoucherFormModal';
import AdvanceVoucherApprovalActions from '@/components/AdvanceVoucherApprovalActions';

interface AdvanceVoucher {
  id: number;
  advanceNo: string;
  type: string;
  advanceDate: string;
  currency: string;
  approvalStatus: string;
  rejectReason?: string | null;
  createdById?: number | null;
  advanceStaffId?: number | null;
  sheet: { id: number; sheetNumber: string } | null;
  customer: { id: number; companyName: string } | null;
  createdBy: { id: number; fullName: string } | null;
  advanceStaff: { id: number; fullName: string } | null;
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

const STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp',
  pending_dept: 'Chờ chủ quản bộ phận',
  pending_accountant: 'Chờ Kế toán',
  approved: 'Đã duyệt',
  paid: 'Đã chi - chờ nhận',
  received: 'Hoàn tất',
  rejected: 'Từ chối',
  not_required: 'Không cần duyệt',
};

const STATUS_COLOR: Record<string, string> = {
  draft: 'default',
  pending_dept: 'warning',
  pending_accountant: 'warning',
  approved: 'processing',
  paid: 'purple',
  received: 'success',
  rejected: 'error',
  not_required: 'default',
};

const STATUS_TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'draft', label: 'Nháp' },
  { key: 'pending', label: 'Chờ chủ quản' },
  { key: 'approved', label: 'Đã duyệt' },
  { key: 'not_required', label: 'Không cần duyệt' },
  { key: 'rejected', label: 'Từ chối' },
];

export default function AdvanceVouchersPage() {
  const { message } = App.useApp();
  const { can } = usePermissions();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(
    async (kw = '', pg = 1, st?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(pg) });
        if (kw) params.set('search', kw);
        if (st) params.set('status', st);
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
    load(search, 1, status);
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
      load(search, page, status);
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
        style={{ width: '100%', maxWidth: 420, marginBottom: 12 }}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onSearch={handleSearch}
      />

      <Tabs
        activeKey={status ?? ''}
        onChange={(k) => {
          const st = k || undefined;
          setStatus(st);
          setPage(1);
          load(search, 1, st);
        }}
        items={STATUS_TABS.map((t) => ({ key: t.key, label: t.label }))}
        style={{ marginBottom: 4 }}
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
            load(search, p, status);
          },
        }}
        scroll={{ x: 1150 }}
        columns={[
          {
            title: 'Advance No',
            dataIndex: 'advanceNo',
            fixed: 'left' as const,
            width: 120,
            render: (v: string, r: AdvanceVoucher) => (
              <Link href={`/advance-vouchers/${r.id}`} className="font-medium text-blue-600 hover:underline">
                <Typography.Text code>{v}</Typography.Text>
              </Link>
            ),
          },
          { title: 'Loại', dataIndex: 'type', width: 130, render: (v: string) => <Tag color="blue">{v}</Tag> },
          {
            title: 'Ngày tạo',
            dataIndex: 'advanceDate',
            width: 100,
            render: (v: string) => new Date(v).toLocaleDateString('vi-VN'),
          },
          { title: 'NV tạo', width: 130, render: (_: unknown, r: AdvanceVoucher) => r.createdBy?.fullName ?? '-' },
          { title: 'NV ứng tiền', width: 130, render: (_: unknown, r: AdvanceVoucher) => r.advanceStaff?.fullName ?? r.createdBy?.fullName ?? '-' },
          { title: 'Job', width: 110, render: (_: unknown, r: AdvanceVoucher) => r.sheet?.sheetNumber ?? '-' },
          {
            title: 'Khách hàng',
            width: 180,
            ellipsis: true,
            render: (_: unknown, r: AdvanceVoucher) => r.customer?.companyName ?? '-',
          },
          {
            title: 'Current',
            dataIndex: 'currency',
            width: 80,
            align: 'center' as const,
            render: (v: string) => <Tag color={v === 'USD' ? 'green' : 'default'}>{v}</Tag>,
          },
          {
            title: 'Tổng tiền',
            width: 130,
            align: 'right' as const,
            render: (_: unknown, r: AdvanceVoucher) => <span className="font-medium">{fmtMoney(r.totalAmount)}</span>,
          },
          {
            title: 'Trạng thái',
            dataIndex: 'approvalStatus',
            width: 160,
            render: (v: string, r: AdvanceVoucher) => (
              <Tooltip title={v === 'rejected' ? r.rejectReason : undefined}>
                <Tag color={STATUS_COLOR[v] ?? 'default'}>{STATUS_LABEL[v] ?? v}</Tag>
              </Tooltip>
            ),
          },
          {
            title: 'Thao tác',
            key: 'actions',
            width: 320,
            render: (_: unknown, r: AdvanceVoucher) => {
              const editable =
                r.type !== 'Chi trực tiếp' || r.approvalStatus === 'draft' || r.approvalStatus === 'rejected';
              return (
                <div className="flex flex-wrap items-center gap-1">
                  <AdvanceVoucherApprovalActions
                    voucher={r}
                    onChanged={() => load(search, page, status)}
                  />
                  {editable && can('advance_voucher', 'edit') && (
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r.id)} />
                  )}
                  {editable && can('advance_voucher', 'delete') && (
                    <Popconfirm title="Xóa phiếu này?" onConfirm={() => handleDelete(r.id)} okText="Xóa" cancelText="Hủy">
                      <Button size="small" danger>
                        Xóa
                      </Button>
                    </Popconfirm>
                  )}
                </div>
              );
            },
          },
        ]}
      />

      <AdvanceVoucherFormModal
        open={modalOpen}
        editingId={editingId}
        onClose={() => setModalOpen(false)}
        onSaved={() => load(search, page, status)}
      />
    </div>
  );
}
