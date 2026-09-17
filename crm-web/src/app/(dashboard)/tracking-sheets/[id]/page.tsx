'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Descriptions, Popconfirm, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, PrinterOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { apiDownload, apiFetch, saveBlob } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermission';
import type { JobOrderItem } from '@/components/JobOrderModal';
import type { JobBookingItem } from '@/components/JobBookingModal';
import type { DebitNoteItem } from '@/components/DebitNoteModal';

const JobOrderModal = dynamic(() => import('@/components/JobOrderModal'), { ssr: false });
const JobBookingModal = dynamic(() => import('@/components/JobBookingModal'), { ssr: false });
const DebitNoteModal = dynamic(() => import('@/components/DebitNoteModal'), { ssr: false });

interface StaffRef {
  id: number;
  fullName: string;
}

interface CustomerRef {
  id: number;
  customerName: string;
  companyName: string;
}

interface CarrierRef {
  id: number;
  carrierName: string;
  companyName: string;
}

interface AgentRef {
  id: number;
  agentName: string;
  companyName: string;
}

interface TrackingSheetDetail {
  id: number;
  sheetNumber: string;
  docStaff: StaffRef | null;
  deliveryStaff: StaffRef | null;
  nw: string | null;
  containerNumber: string | null;
  customer: CustomerRef | null;
  carrier: CarrierRef | null;
  agent: AgentRef | null;
  fromLocation: string | null;
  toLocation: string | null;
  containerQuantity: string | null;
  etaDate: string | null;
  gw: string | null;
  customNo: string | null;
  declarationDate: string | null;
  billNumber: string | null;
  invoiceNumber: string | null;
  pol: string | null;
  pod: string | null;
  phanLuong: string | null;
  note: string | null;
  jobOrders: JobOrderItem[];
  jobBookings: JobBookingItem[];
  debitNotes: DebitNoteItem[];
  advanceVouchers?: Array<{
    id: number;
    type: string;
    items: Array<{ amount: string | number; kind?: string | null }>;
  }>;
}

// Chuẩn tiền x100: DB lưu *100, hiển thị chia 100
const MONEY_SCALE = 100;
function fmtMoney(v: string | null) {
  if (v == null) return '-';
  const n = Number(v);
  return Number.isNaN(n) ? '-' : (n / MONEY_SCALE).toLocaleString('vi-VN');
}
function fmtWeight(v: string | null) {
  if (v == null) return '-';
  const n = Number(v);
  return Number.isNaN(n) ? '-' : n.toLocaleString('vi-VN');
}

// Định dạng ngày YYYY/MM/DD
function fmtDate(v: string | null) {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('vi-VN');
}

function sortByType<T extends { id: number; type: string }>(items: T[]) {
  return [...items].sort((a, b) => a.type.localeCompare(b.type, 'vi') || a.id - b.id);
}

export default function TrackingSheetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { message } = App.useApp();
  const { can } = usePermissions();
  const canViewOrder = can('job_order', 'view');
  const canCreateOrder = can('job_order', 'create');
  const canEditOrder = can('job_order', 'edit');
  const canDeleteOrder = can('job_order', 'delete');
  const canViewBooking = can('job_booking', 'view');
  const canCreateBooking = can('job_booking', 'create');
  const canEditBooking = can('job_booking', 'edit');
  const canDeleteBooking = can('job_booking', 'delete');
  const canViewDebit = can('debit_note', 'view');
  const canCreateDebit = can('debit_note', 'create');
  const canEditDebit = can('debit_note', 'edit');
  const canDeleteDebit = can('debit_note', 'delete');
  const [sheet, setSheet] = useState<TrackingSheetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<JobOrderItem | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<JobBookingItem | null>(null);
  const [debitModalOpen, setDebitModalOpen] = useState(false);
  const [editingDebit, setEditingDebit] = useState<DebitNoteItem | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [selectedBookingIds, setSelectedBookingIds] = useState<number[]>([]);
  const [selectedDebitIds, setSelectedDebitIds] = useState<number[]>([]);

  const sortedOrders = useMemo(() => sortByType(sheet?.jobOrders ?? []), [sheet]);
  const sortedBookings = useMemo(() => sortByType(sheet?.jobBookings ?? []), [sheet]);
  const sortedDebits = useMemo(() => sortByType(sheet?.debitNotes ?? []), [sheet]);
  const totalOrder = useMemo(() => (sheet?.jobOrders ?? []).reduce((s, r) => s + Number((r as any).portAmt ?? 0), 0), [sheet]);
  const totalBooking = useMemo(() => (sheet?.jobBookings ?? []).reduce((s, r) => s + Number((r as any).total ?? 0), 0), [sheet]);
  const totalDebit = useMemo(() => (sheet?.debitNotes ?? []).reduce((s, r) => s + Number((r as any).total ?? 0), 0), [sheet]);
  // Tổng tạm ứng chỉ tính khoản Chi (không trừ Giảm trừ), chỉ phiếu Chi tạm ứng
  const totalTamUng = useMemo(() => {
    const vouchers = sheet?.advanceVouchers ?? [];
    return vouchers
      .filter((v) => v.type === 'Chi tạm ứng')
      .reduce((sum, v) => sum + (v.items ?? []).filter((it: any) => it.kind !== 'Giảm trừ').reduce((s, it: any) => s + Number(it.amount ?? 0), 0), 0);
  }, [sheet]);

  const load = useCallback(async () => {
    const id = (await params).id;
    setLoading(true);
    try {
      const res = await apiFetch<TrackingSheetDetail>(`/tracking-sheets/${id}`);
      setSheet(res);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không tải được phiếu theo dõi');
    } finally {
      setLoading(false);
    }
  }, [params, message]);

  useEffect(() => {
    load();
  }, [load]);

  // Hàm openAddOrder: xử lý openAddOrder
  function openAddOrder() {
    setEditingOrder(null);
    setOrderModalOpen(true);
  }

  // Hàm openEditOrder: xử lý openEditOrder
  function openEditOrder(item: JobOrderItem) {
    setEditingOrder(item);
    setOrderModalOpen(true);
  }

  // Hàm deleteOrder: xử lý deleteOrder
  async function deleteOrder(item: JobOrderItem) {
    try {
      await apiFetch(`/tracking-sheets/${sheet?.id}/job-orders/${item.id}`, { method: 'DELETE' });
      message.success('Đã xóa mục Job Order');
      load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  }

  // Hàm openAddBooking: xử lý openAddBooking
  function openAddBooking() {
    setEditingBooking(null);
    setBookingModalOpen(true);
  }

  // Hàm openEditBooking: xử lý openEditBooking
  function openEditBooking(item: JobBookingItem) {
    setEditingBooking(item);
    setBookingModalOpen(true);
  }

  // Hàm deleteBooking: xử lý deleteBooking
  async function deleteBooking(item: JobBookingItem) {
    try {
      await apiFetch(`/tracking-sheets/${sheet?.id}/job-bookings/${item.id}`, { method: 'DELETE' });
      message.success('Đã xóa mục Job Book');
      load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  }

  // Hàm openAddDebit: xử lý openAddDebit
  function openAddDebit() {
    setEditingDebit(null);
    setDebitModalOpen(true);
  }

  // Hàm openEditDebit: xử lý openEditDebit
  function openEditDebit(item: DebitNoteItem) {
    setEditingDebit(item);
    setDebitModalOpen(true);
  }

  // Xóa mềm Job item
  async function deleteDebit(item: DebitNoteItem) {
    try {
      await apiFetch(`/tracking-sheets/${sheet?.id}/debit-notes/${item.id}`, { method: 'DELETE' });
      message.success('Đã xóa Debit Note');
      load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  }

  const totalSelected = selectedOrderIds.length + selectedBookingIds.length + selectedDebitIds.length;

  // Hàm exportJobs: xử lý exportJobs
  async function exportJobs(type: 'order' | 'booking' | 'debit') {
    if (!sheet) return;
    try {
      const blob = await apiDownload(`/tracking-sheets/${sheet.id}/export?type=${type}`);
      const prefix = type === 'order' ? 'job-order' : type === 'booking' ? 'job-book-tau' : 'debit-note';
      saveBlob(blob, `${prefix}-${sheet.sheetNumber}.xlsx`);
      message.success('Đã xuất file Excel');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xuất Excel thất bại');
    }
  }

  // Hàm openPrint: xử lý openPrint
  function openPrint() {
    if (!sheet) return;
    const parts = [`ids=${sheet.id}`];
    if (totalSelected > 0) {
      parts.push(`orders=${selectedOrderIds.join(',')}`);
      parts.push(`bookings=${selectedBookingIds.join(',')}`);
      parts.push(`debits=${selectedDebitIds.join(',')}`);
    }
    window.open(`/print/tracking-sheets?${parts.join('&')}`, '_blank', 'noopener');
  }

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Link href="/tracking-sheets">
          <Button icon={<ArrowLeftOutlined />}>Quay lại</Button>
        </Link>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Phiếu {sheet?.sheetNumber ?? ''}
        </Typography.Title>
        {sheet && (
          <Button type="primary" icon={<PrinterOutlined />} onClick={openPrint}>
            {totalSelected > 0 ? `In mục đã chọn (${totalSelected})` : 'In phiếu'}
          </Button>
        )}
      </Space>

      <Card loading={loading} style={{ marginBottom: 16 }}>
        {sheet && (
          <Descriptions
            bordered
            size="small"
            column={{ xs: 1, sm: 2, lg: 4 }}
            items={[
              { key: 'customer', label: 'Khách hàng', children: sheet.customer ? `${sheet.customer.companyName} (#${sheet.customer.id})` : '-' },
              { key: 'carrier', label: 'Hãng tàu', children: sheet.carrier ? `${sheet.carrier.carrierName} (#${sheet.carrier.id})` : '-' },
              { key: 'agent', label: 'Đại lý', children: sheet.agent ? `${sheet.agent.agentName} (#${sheet.agent.id})` : '-' },
              { key: 'container', label: 'Số container', children: sheet.containerNumber ?? '-' },
              { key: 'route', label: 'Tuyến', children: `${sheet.fromLocation ?? '?'} → ${sheet.toLocation ?? '?'}` },
              { key: 'containerQty', label: 'Số lượng container', children: sheet.containerQuantity ?? '-' },
              { key: 'phanLuong', label: 'Phân Luồng', children: (sheet as any).phanLuong ?? '-' },
              { key: 'createdBy', label: 'Người tạo', children: (sheet as { createdBy?: StaffRef | null }).createdBy?.fullName ?? '-' },
              { key: 'nw', label: 'NW', children: fmtWeight(sheet.nw) },
              { key: 'gw', label: 'GW', children: fmtWeight(sheet.gw) },
              { key: 'eta', label: 'Ngày ETA/ETD', children: fmtDate(sheet.etaDate) },
              { key: 'customNo', label: 'Custom No', children: sheet.customNo ?? '-' },
              { key: 'decl', label: 'Ngày tờ khai', children: fmtDate(sheet.declarationDate) },
              { key: 'bill', label: 'Số bill', children: sheet.billNumber ?? '-' },
              { key: 'invoice', label: 'Số hóa đơn', children: sheet.invoiceNumber ?? '-' },
              { key: 'note', label: 'Ghi chú', children: sheet.note ?? '-' },
            ]}
          />
        )}
      </Card>

      {canViewOrder && (
      <Card
        title="Job Order"
        extra={
          <Space>
            {totalTamUng > 0 && (
              <Tag color="blue">Đã tạm ứng: {fmtMoney(String(totalTamUng))}</Tag>
            )}
            <Button size="small" icon={<DownloadOutlined />} onClick={() => exportJobs('order')}>
              Xuất Excel
            </Button>
            {canCreateOrder && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openAddOrder} size="small">
                Thêm mục
              </Button>
            )}
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Table<JobOrderItem>
          size="small"
          rowKey="id"
          loading={loading}
          dataSource={sortedOrders}
          rowSelection={{
            selectedRowKeys: selectedOrderIds,
            onChange: (keys) => setSelectedOrderIds(keys as number[]),
          }}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (t) => `${t} mục`,
          }}
          locale={{ emptyText: 'Chưa có mục Job Order' }}
          scroll={{ x: 1000 }}
          summary={() => {
            const total = totalOrder;
            return (
              <>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={5} align="right"><strong>Tổng tiền:</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right"><strong>{fmtMoney(String(total))}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={6} colSpan={2} />
                </Table.Summary.Row>
                {totalTamUng > 0 && (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={5} align="right"><span style={{ color: '#888' }}>Đã tạm ứng (chỉ Chi):</span></Table.Summary.Cell>
                    <Table.Summary.Cell index={5} align="right"><strong>{fmtMoney(String(totalTamUng))}</strong></Table.Summary.Cell>
                    <Table.Summary.Cell index={6} colSpan={2} />
                  </Table.Summary.Row>
                )}
              </>
            );
          }}
          tableLayout="fixed"
          columns={[
            { title: 'Phân loại', dataIndex: 'type', width: 140, render: (v: string) => <Tag color="blue">{v}</Tag> },
            { title: 'Mô tả', dataIndex: 'description', width: 220, ellipsis: true, render: (v: string | null) => (v ? <Tooltip title={v}><span>{v}</span></Tooltip> : '-') },
            { title: 'NV giao nhận', key: 'deliveryStaff', width: 140, ellipsis: true, render: (_: unknown, r: JobOrderItem) => (r as any).deliveryStaff?.fullName ?? '-' },
            { title: 'Trước thuế', dataIndex: 'pretaxAmount', align: 'right' as const, render: (v: string | null) => (v == null ? '-' : fmtMoney(v)) },
            { title: 'Thuế', dataIndex: 'taxRate', align: 'center' as const, render: (v: string | null) => (v == null ? '-' : `${Number(v)}%`) },
            { title: 'Thành Tiền', dataIndex: 'portAmt', align: 'right' as const, render: fmtMoney },
            { title: 'Ghi chú', dataIndex: 'note', width: 200, ellipsis: true, render: (v: string | null) => (v ? <Tooltip title={v}><span>{v}</span></Tooltip> : '-') },
            {
              title: 'Thao tác',
              key: 'actions',
              width: 110,
              render: (_: unknown, item: JobOrderItem) => (
                <Space>
                  {canEditOrder && <Button size="small" icon={<EditOutlined />} onClick={() => openEditOrder(item)} />}
                  {canDeleteOrder && (
                    <Popconfirm title="Xóa mục này?" onConfirm={() => deleteOrder(item)} okText="Xóa" cancelText="Hủy">
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
      )}

      {canViewBooking && (
      <Card
        title="Job Book tàu"
        extra={
          <Space>
            <Button size="small" icon={<DownloadOutlined />} onClick={() => exportJobs('booking')}>
              Xuất Excel
            </Button>
            {canCreateBooking && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openAddBooking} size="small">
                Thêm mục
              </Button>
            )}
          </Space>
        }
      >
        <Table<JobBookingItem>
          size="small"
          rowKey="id"
          loading={loading}
          dataSource={sortedBookings}
          rowSelection={{
            selectedRowKeys: selectedBookingIds,
            onChange: (keys) => setSelectedBookingIds(keys as number[]),
          }}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (t) => `${t} mục`,
          }}
          locale={{ emptyText: 'Chưa có mục Job Book' }}
          scroll={{ x: 1200 }}
          summary={() => {
            const total = totalBooking;
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={8} align="right"><strong>Tổng tiền:</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={8} align="right"><strong>{fmtMoney(String(total))}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={9} />
              </Table.Summary.Row>
            );
          }}
          tableLayout="fixed"
          columns={[
            { title: 'Loại', dataIndex: 'type', width: 140, render: (v: string) => <Tag color="blue">{v}</Tag> },
            { title: 'Mô tả', dataIndex: 'description', width: 220, ellipsis: true, render: (v: string | null) => (v ? <Tooltip title={v}><span>{v}</span></Tooltip> : '-') },
            { title: 'Đơn vị tính', dataIndex: 'unit', render: (v: string | null) => v ?? '-' },
            { title: 'Số lượng', dataIndex: 'quantity', align: 'right' as const, render: (v: string | null) => (v == null ? '-' : Number(v)) },
            { title: 'Trước thuế', dataIndex: 'pretaxAmount', align: 'right' as const, render: fmtMoney },
            { title: 'Thuế', dataIndex: 'taxRate', align: 'center' as const, render: (v: string | null) => (v == null ? '-' : `${Number(v)}%`) },
            { title: 'Tiền thuế', dataIndex: 'taxAmount', align: 'right' as const, render: fmtMoney },
            { title: 'Sau thuế', dataIndex: 'afterTaxAmount', align: 'right' as const, render: fmtMoney },
            { title: 'Tổng tiền', dataIndex: 'total', align: 'right' as const, render: (v: string | null) => <span className="font-medium">{fmtMoney(v)}</span> },
            {
              title: 'Thao tác',
              key: 'actions',
              width: 110,
              render: (_: unknown, item: JobBookingItem) => (
                <Space>
                  {canEditBooking && <Button size="small" icon={<EditOutlined />} onClick={() => openEditBooking(item)} />}
                  {canDeleteBooking && (
                    <Popconfirm title="Xóa mục này?" onConfirm={() => deleteBooking(item)} okText="Xóa" cancelText="Hủy">
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
      )}

      {canViewDebit && (
      <Card
        title="Debit Note"
        extra={
          <Space>
            <Button size="small" icon={<DownloadOutlined />} onClick={() => exportJobs('debit')}>
              Xuất Excel
            </Button>
            {canCreateDebit && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openAddDebit} size="small">
                Thêm mục
              </Button>
            )}
          </Space>
        }
        style={{ marginTop: 16 }}
      >
        <Table<DebitNoteItem>
          size="small"
          rowKey="id"
          loading={loading}
          dataSource={sortedDebits}
          rowSelection={{
            selectedRowKeys: selectedDebitIds,
            onChange: (keys) => setSelectedDebitIds(keys as number[]),
          }}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (t) => `${t} mục`,
          }}
          locale={{ emptyText: 'Chưa có mục Debit Note' }}
          scroll={{ x: 1200 }}
          summary={() => {
            const total = totalDebit;
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={10} align="right"><strong>Tổng tiền:</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={10} align="right"><strong>{fmtMoney(String(total))}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={11} />
              </Table.Summary.Row>
            );
          }}
          tableLayout="fixed"
          columns={[
            { title: 'Loại', dataIndex: 'type', width: 140, render: (v: string) => <Tag color="blue">{v}</Tag> },
            { title: 'Số hóa đơn', dataIndex: 'invoiceNumber', width: 140, ellipsis: true, render: (v: string | null) => (v ? <Tooltip title={v}><span>{v}</span></Tooltip> : '-') },
            { title: 'Mô tả', dataIndex: 'description', width: 220, ellipsis: true, render: (v: string | null) => (v ? <Tooltip title={v}><span>{v}</span></Tooltip> : '-') },
            { title: 'Unit', dataIndex: 'unit', render: (v: string | null) => v ?? '-' },
            { title: 'Current', dataIndex: 'currency', align: 'center' as const, render: (v: string) => <Tag color={v === 'USD' ? 'green' : 'default'}>{v}</Tag> },
            { title: 'Số lượng', dataIndex: 'quantity', align: 'right' as const, render: (v: string | null) => (v == null ? '-' : Number(v)) },
            { title: 'Giá VND', dataIndex: 'priceVnd', align: 'right' as const, render: fmtMoney },
            { title: 'Giá USD', dataIndex: 'priceUsd', align: 'right' as const, render: (v: string | null) => (v == null ? '-' : (Number(v) / MONEY_SCALE).toLocaleString('en-US')) },
            { title: 'Tỷ giá', dataIndex: 'exchangeRate', align: 'right' as const, render: (v: string | null) => (v == null ? '-' : Number(v).toLocaleString('vi-VN')) },
            { title: 'Thuế', dataIndex: 'taxRate', align: 'center' as const, render: (v: string | null) => (v == null ? '-' : `${Number(v)}%`) },
            { title: 'Tổng tiền', dataIndex: 'total', align: 'right' as const, render: (v: string | null) => <span className="font-medium">{fmtMoney(v)}</span> },
            {
              title: 'Thao tác',
              key: 'actions',
              width: 110,
              render: (_: unknown, item: DebitNoteItem) => (
                <Space>
                  {canEditDebit && <Button size="small" icon={<EditOutlined />} onClick={() => openEditDebit(item)} />}
                  {canDeleteDebit && (
                    <Popconfirm title="Xóa mục này?" onConfirm={() => deleteDebit(item)} okText="Xóa" cancelText="Hủy">
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
      )}

      <JobOrderModal
        open={orderModalOpen}
        sheetId={sheet?.id ?? 0}
        editing={editingOrder}
        onClose={() => setOrderModalOpen(false)}
        onSaved={load}
      />
      <JobBookingModal
        open={bookingModalOpen}
        sheetId={sheet?.id ?? 0}
        editing={editingBooking}
        onClose={() => setBookingModalOpen(false)}
        onSaved={load}
      />
      <DebitNoteModal
        open={debitModalOpen}
        sheetId={sheet?.id ?? 0}
        editing={editingDebit}
        onClose={() => setDebitModalOpen(false)}
        onSaved={load}
      />
    </div>
  );
}