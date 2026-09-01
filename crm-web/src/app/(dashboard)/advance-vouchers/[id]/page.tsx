'use client';

import { useCallback, useEffect, useState } from 'react';
import { App, Breadcrumb, Button, Card, Descriptions, Empty, Popconfirm, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, PrinterOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import AdvanceVoucherFormModal from '@/components/AdvanceVoucherFormModal';
import AdvanceItemModal, { AdvanceItem } from '@/components/AdvanceItemModal';

interface AdvanceVoucher {
  id: number;
  advanceNo: string;
  type: string;
  advanceDate: string;
  currency: string;
  sheet: { id: number; sheetNumber: string } | null;
  customer: { id: number; customerName: string; companyName: string } | null;
  createdBy: { id: number; fullName: string } | null;
  orderFrom: string | null;
  orderTo: string | null;
  containerQty: number | null;
  qty: string | null;
  note: string | null;
  totalAmount: number;
  items: AdvanceItem[];
}

// Định dạng số tiền/số lượng theo chuẩn vi-VN
function fmtMoney(v: number | string | null | undefined) {
  if (v == null) return '-';
  return new Intl.NumberFormat('vi-VN').format(Number(v));
}

export default function AdvanceVoucherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { message } = App.useApp();
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

  const info = [
    { label: 'Advance No', value: voucher.advanceNo },
    { label: 'Loại', value: voucher.type },
    { label: 'Ngày tạo', value: new Date(voucher.advanceDate).toLocaleDateString('vi-VN') },
    { label: 'Nhân viên tạo', value: voucher.createdBy?.fullName },
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
        <div className="flex gap-2">
          <Button icon={<PrinterOutlined />} onClick={() => window.open(`/print/advance-vouchers?ids=${voucher.id}`, '_blank')}>
            In phiếu
          </Button>
          <Button type="primary" icon={<EditOutlined />} onClick={() => setFormOpen(true)} block className="sm:!w-auto">
            Sửa phiếu
          </Button>
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
      </Card>

      <Card
        title={`Các khoản chi (${voucher.items.length})`}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddItem} size="small">
            Thêm khoản chi
          </Button>
        }
      >
        <Table<AdvanceItem>
          size="small"
          rowKey="id"
          dataSource={voucher.items}
          pagination={false}
          locale={{ emptyText: 'Chưa có khoản chi' }}
          columns={[
            { title: 'Tiền', dataIndex: 'amount', align: 'right' as const, render: (v: string) => <span className="font-medium">{fmtMoney(v)}</span> },
            { title: 'Ghi chú', dataIndex: 'note', render: (v: string | null) => v ?? '-' },
            {
              title: 'Thao tác',
              key: 'actions',
              width: 110,
              render: (_: unknown, item: AdvanceItem) => (
                <div className="flex gap-1">
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEditItem(item)} />
                  <Popconfirm title="Xóa khoản chi này?" onConfirm={() => deleteItem(item)} okText="Xóa" cancelText="Hủy">
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              ),
            },
          ]}
          summary={(rows) => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} align="right">
                <Tag color="blue">Tổng: {fmtMoney(voucher.totalAmount)} {voucher.currency}</Tag>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} />
              <Table.Summary.Cell index={2} />
            </Table.Summary.Row>
          )}
        />
      </Card>

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