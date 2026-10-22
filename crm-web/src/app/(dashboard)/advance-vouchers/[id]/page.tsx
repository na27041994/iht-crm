'use client';

import { useCallback, useEffect, useState } from 'react';
import { App, Breadcrumb, Button, Card, Descriptions, Empty, Popconfirm, Table, Tag, Timeline, Tooltip, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, PrinterOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import { apiFetch } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermission';
import AdvanceVoucherFormModal from '@/components/AdvanceVoucherFormModal';
import AdvanceItemModal, { AdvanceItem } from '@/components/AdvanceItemModal';
import AdvanceVoucherApprovalActions from '@/components/AdvanceVoucherApprovalActions';

interface AdvanceVoucher {
  id: number;
  advanceNo: string;
  type: string;
  advanceDate: string;
  currency: string;
  sheet: { id: number; sheetNumber: string } | null;
  customer: { id: number; customerName: string; companyName: string } | null;
  createdBy: { id: number; fullName: string } | null;
  advanceStaff: { id: number; fullName: string } | null;
  orderFrom: string | null;
  orderTo: string | null;
  containerQty: number | null;
  qty: string | null;
  note: string | null;
  totalAmount: number;
  items: AdvanceItem[];
  approvalStatus: string;
  rejectReason: string | null;
  submittedByName: string | null;
  submittedAt: string | null;
  deptApprovedByName: string | null;
  deptApprovedAt: string | null;
  deptApproveNote: string | null;
  accountantApprovedByName: string | null;
  accountantApprovedAt: string | null;
  accountantApproveNote: string | null;
  paidByName: string | null;
  paidAt: string | null;
  paidNote: string | null;
  receivedByName: string | null;
  receivedAt: string | null;
  receivedNote: string | null;
  logs: Array<{
    id: number;
    action: string;
    fromStatus: string | null;
    toStatus: string | null;
    byName: string | null;
    note: string | null;
    createdAt: string;
  }>;
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

const ACTION_LABEL: Record<string, string> = {
  submit: 'Trình duyệt',
  approve_dept: 'Trưởng bộ phận duyệt',
  approve_accountant: 'Kế toán duyệt',
  reject_dept: 'Trưởng bộ phận từ chối',
  reject_accountant: 'Kế toán từ chối',
  pay: 'Thủ quỹ xác nhận đã chi',
  receive: 'Người nhận xác nhận đã nhận',
  admin_reset: 'Admin mở khóa',
};

function fmtDateTime(v: string | null) {
  return v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '-';
}

const MONEY_SCALE = 100;
function fmtMoney(v: number | string | null | undefined) {
  if (v == null) return '-';
  return new Intl.NumberFormat('vi-VN').format(Number(v) / MONEY_SCALE);
}

export default function AdvanceVoucherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { message } = App.useApp();
  const { can } = usePermissions();
  const [voucher, setVoucher] = useState<AdvanceVoucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdvanceItem | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const v = await apiFetch<AdvanceVoucher>(`/advance-vouchers/${id}`);
      setVoucher(v);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không tải được phiếu');
      setVoucher(null);
    } finally {
      setLoading(false);
    }
  }, [id, message]);

  useEffect(() => {
    let cancelled = false;
    params.then(({ id: pid }) => {
      const numId = Number(pid);
      setId(numId);
      if (!cancelled) setLoading(true);
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  // Hàm openAddItem: xử lý openAddItem
  function openAddItem() {
    setEditingItem(null);
    setItemModalOpen(true);
  }

  // Hàm openEditItem: xử lý openEditItem
  function openEditItem(item: AdvanceItem) {
    setEditingItem(item);
    setItemModalOpen(true);
  }

  // Hàm deleteItem: xử lý deleteItem
  async function deleteItem(item: AdvanceItem) {
    if (!voucher) return;
    try {
      await apiFetch(`/advance-vouchers/${voucher.id}/items/${item.id}`, { method: 'DELETE' });
      message.success('Đã xóa khoản chi');
      load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  }

  if (loading) {
    return <Card loading style={{ minHeight: 200 }} />;
  }

  if (!voucher) {
    return (
      <Card>
        <Empty description="Không tìm thấy phiếu chi tạm ứng" />
      </Card>
    );
  }

  const isDirect = voucher.type === 'Chi trực tiếp';
  const editable = !isDirect || voucher.approvalStatus === 'draft' || voucher.approvalStatus === 'rejected';
  const info = [
    { label: 'Advance No', value: voucher.advanceNo },
    { label: 'Trạng thái', value: <Tag color={STATUS_COLOR[voucher.approvalStatus] ?? 'default'}>{STATUS_LABEL[voucher.approvalStatus] ?? voucher.approvalStatus}</Tag> },
    { label: 'Loại', value: voucher.type },
    { label: 'Ngày tạo', value: new Date(voucher.advanceDate).toLocaleDateString('vi-VN') },
    { label: 'Nhân viên tạo', value: voucher.createdBy?.fullName },
    { label: 'NV ứng tiền', value: voucher.advanceStaff?.fullName ?? voucher.createdBy?.fullName },
    { label: 'Job', value: voucher.sheet?.sheetNumber },
    {
      label: 'Khách hàng',
      value: voucher.customer ? `${voucher.customer.companyName}` : '-',
    },
    { label: 'Current', value: voucher.currency },
    { label: 'Order From', value: voucher.orderFrom },
    { label: 'Order To', value: voucher.orderTo },
    { label: 'Container Qty', value: voucher.containerQty },
    { label: 'Qty', value: voucher.qty },
    ...(isDirect
      ? [
          { label: 'Người trình', value: voucher.submittedByName ? `${voucher.submittedByName} · ${fmtDateTime(voucher.submittedAt)}` : '-' },
          { label: 'Chủ quản bộ phận', value: voucher.deptApprovedByName ? `${voucher.deptApprovedByName} · ${fmtDateTime(voucher.deptApprovedAt)}` : '-' },
        ]
      : []),
  ];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Breadcrumb
            style={{ marginBottom: 8 }}
            items={[{ title: <Link href="/advance-vouchers">Phiếu chi tạm ứng</Link> }, { title: voucher.advanceNo }]}
          />
          <Typography.Title level={3} style={{ margin: 0 }}>
            Phiếu {voucher.advanceNo}
          </Typography.Title>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdvanceVoucherApprovalActions voucher={voucher} onChanged={load} size="middle" />
          <Button icon={<PrinterOutlined />} onClick={() => window.open(`/print/advance-vouchers?ids=${voucher.id}`, '_blank')}>
            In phiếu
          </Button>
          {editable && can('advance_voucher', 'edit') && (
            <Button type="primary" icon={<EditOutlined />} onClick={() => setFormOpen(true)} block className="sm:!w-auto">
              Sửa phiếu
            </Button>
          )}
        </div>
      </div>

      <Card title="Thông tin phiếu" style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="middle">
          {info.map((item) => (
            <Descriptions.Item key={item.label} label={item.label}>
              {item.value ?? '-'}
            </Descriptions.Item>
          ))}
        </Descriptions>
        {voucher.note && (
          <Typography.Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
            <Typography.Text strong>Ghi chú: </Typography.Text>
            {voucher.note}
          </Typography.Paragraph>
        )}
        {voucher.approvalStatus === 'rejected' && voucher.rejectReason && (
          <Typography.Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
            <Typography.Text strong type="danger">Lý do từ chối: </Typography.Text>
            <Typography.Text type="danger">{voucher.rejectReason}</Typography.Text>
          </Typography.Paragraph>
        )}
      </Card>

      <Card
        title={`Các khoản chi (${voucher.items.length})`}
        extra={
          editable && can('advance_voucher', 'edit') ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAddItem} size="small">
              Thêm khoản chi
            </Button>
          ) : null
        }
      >
        <Table<AdvanceItem>
          size="small"
          rowKey="id"
          dataSource={voucher.items}
          pagination={false}
          tableLayout="fixed"
          locale={{ emptyText: 'Chưa có khoản chi' }}
          columns={[
            { title: 'Loại', dataIndex: 'kind', width: 110, render: (v: string | null) => <Tag color={v === 'Giảm trừ' ? 'red' : 'blue'}>{v ?? 'Chi'}</Tag> },
            { title: 'Mô tả', dataIndex: 'description', width: 220, ellipsis: true, render: (v: string | null) => (v ? <Tooltip title={v}><span>{v}</span></Tooltip> : '-') },
            { title: 'Tiền', dataIndex: 'amount', align: 'right' as const, render: (v: string, r: AdvanceItem) => <span className="font-medium" style={(r as any).kind === 'Giảm trừ' ? { color: '#cf1322' } : undefined}>{(r as any).kind === 'Giảm trừ' ? `- ${fmtMoney(v)}` : fmtMoney(v)}</span> },
            { title: 'Ghi chú', dataIndex: 'note', ellipsis: true, render: (v: string | null) => v ?? '-' },
            {
              title: 'Thao tác',
              key: 'actions',
              width: 110,
              render: (_: unknown, item: AdvanceItem) => {
                if (!editable || !can('advance_voucher', 'edit')) return null;
                return (
                  <div className="flex gap-1">
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEditItem(item)} />
                    <Popconfirm title="Xóa khoản chi này?" onConfirm={() => deleteItem(item)} okText="Xóa" cancelText="Hủy">
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                );
              },
            },
          ]}
          summary={() => {
            const chi = voucher.items.filter((i: any) => i.kind !== 'Giảm trừ').reduce((s, i: any) => s + Number(i.amount ?? 0), 0);
            const giam = voucher.items.filter((i: any) => i.kind === 'Giảm trừ').reduce((s, i: any) => s + Number(i.amount ?? 0), 0);
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} align="right">
                  <Tag color="blue">Tổng: {fmtMoney(voucher.totalAmount)} {voucher.currency}</Tag>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <span style={{ fontSize: 12, color: '#888' }}>Chi: {fmtMoney(String(chi))} - Giảm trừ: {fmtMoney(String(giam))}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} />
                <Table.Summary.Cell index={3} />
                <Table.Summary.Cell index={4} />
              </Table.Summary.Row>
            );
          }}
        />
      </Card>

      {isDirect && (
      <Card title="Lịch sử duyệt" style={{ marginBottom: 16 }}>
        {voucher.logs?.length ? (
          <Timeline
            items={voucher.logs.map((log) => ({
              color: log.toStatus === 'rejected' ? 'red' : log.toStatus === 'received' ? 'green' : 'blue',
              children: (
                <div>
                  <div>
                    <strong>{ACTION_LABEL[log.action] ?? log.action}</strong>
                    {log.byName ? ` · ${log.byName}` : ''}
                    <span style={{ color: '#999', marginLeft: 8 }}>{fmtDateTime(log.createdAt)}</span>
                  </div>
                  {log.note && <div style={{ color: '#666' }}>{log.note}</div>}
                </div>
              ),
            }))}
          />
        ) : (
          <Typography.Text type="secondary">Chưa có lịch sử duyệt</Typography.Text>
        )}
      </Card>
      )}

      <AdvanceVoucherFormModal
        open={formOpen}
        editingId={voucher.id}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />
      <AdvanceItemModal
        open={itemModalOpen}
        voucherId={voucher.id}
        editing={editingItem}
        onClose={() => setItemModalOpen(false)}
        onSaved={load}
      />
    </div>
  );
}