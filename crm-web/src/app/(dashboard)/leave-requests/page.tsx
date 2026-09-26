'use client';

import { useCallback, useEffect, useState } from 'react';
import { App, Button, Empty, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { apiFetch } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import LeaveRequestFormModal, { LeaveItem } from '@/components/LeaveRequestFormModal';
import dayjs from 'dayjs';

interface LeaveRequest extends LeaveItem {
  days: string;
  status: 'pending' | 'approved' | 'rejected';
  approveNote: string | null;
  approvedAt: string | null;
  userId: number;
  user: { id: number; fullName: string; email: string };
  approver: { id: number; fullName: string } | null;
  createdAt: string;
}

interface ListResponse {
  items: LeaveRequest[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const STATUS_LABEL: Record<string, string> = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' };
const STATUS_COLOR: Record<string, string> = { pending: 'warning', approved: 'success', rejected: 'error' };

function fmtDate(v: string | null) {
  if (!v) return '-';
  return dayjs(v).format('DD/MM/YYYY');
}

export default function LeaveRequestsPage() {
  const { message } = App.useApp();
  const canView = usePermission('leave_request', 'view');
  const canCreate = usePermission('leave_request', 'create');
  const canDecide = usePermission('leave_request', 'edit');
  const canDelete = usePermission('leave_request', 'delete');
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveItem | null>(null);
  const [decideOpen, setDecideOpen] = useState(false);
  const [deciding, setDeciding] = useState<{ id: number; approve: boolean } | null>(null);
  const [note, setNote] = useState('');
  const [decidingNow, setDecidingNow] = useState(false);
  const [meId, setMeId] = useState<number | null>(null);

  const load = useCallback(
    async (st?: string, pg = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(pg) });
        if (st) params.set('status', st);
        const [res, me] = await Promise.all([
          apiFetch<ListResponse>(`/leave-requests?${params}`),
          apiFetch<{ sub: number }>('/auth/me'),
        ]);
        setData(res);
        setMeId(me.sub);
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Không tải được danh sách nghỉ phép');
      } finally {
        setLoading(false);
      }
    },
    [message],
  );

  useEffect(() => {
    load();
  }, [load]);

  function handleFilter(st?: string) {
    setStatus(st);
    setPage(1);
    load(st, 1);
  }

  async function handleDecide() {
    if (!deciding) return;
    setDecidingNow(true);
    try {
      await apiFetch(`/leave-requests/${deciding.id}/${deciding.approve ? 'approve' : 'reject'}`, {
        method: 'POST',
        body: JSON.stringify({ approveNote: note.trim() ? note.trim() : null }),
      });
      message.success(deciding.approve ? 'Đã duyệt đơn' : 'Đã từ chối đơn');
      setDecideOpen(false);
      setDeciding(null);
      setNote('');
      load(status, page);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xử lý thất bại');
    } finally {
      setDecidingNow(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiFetch(`/leave-requests/${id}`, { method: 'DELETE' });
      message.success('Đã xóa đơn');
      load(status, page);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Nghỉ phép
          </Typography.Title>
          <Typography.Text type="secondary">Đơn xin nghỉ phép của nhân viên</Typography.Text>
        </div>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setModalOpen(true); }} block className="sm:!w-auto">
            Xin nghỉ phép
          </Button>
        )}
      </div>

      {!canView ? (
        <Empty description="Bạn không có quyền xem nghỉ phép" />
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <Select
              placeholder="Trạng thái"
              allowClear
              style={{ width: 160 }}
              value={status}
              onChange={handleFilter}
              options={[
                { value: 'pending', label: 'Chờ duyệt' },
                { value: 'approved', label: 'Đã duyệt' },
                { value: 'rejected', label: 'Từ chối' },
              ]}
            />
          </div>

          <Table<LeaveRequest>
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
                load(status, p);
              },
            }}
            scroll={{ x: 1000 }}
            columns={[
              {
                title: 'Người xin',
                key: 'user',
                width: 180,
                render: (_: unknown, r: LeaveRequest) => r.user.fullName,
              },
              { title: 'Loại nghỉ', dataIndex: 'type', width: 140 },
              {
                title: 'Từ ngày',
                dataIndex: 'fromDate',
                width: 110,
                render: (v: string) => fmtDate(v),
              },
              {
                title: 'Đến ngày',
                dataIndex: 'toDate',
                width: 110,
                render: (v: string) => fmtDate(v),
              },
              {
                title: 'Số ngày',
                dataIndex: 'days',
                width: 80,
                align: 'center' as const,
                render: (v: string) => Number(v),
              },
              { title: 'Lý do', dataIndex: 'reason', ellipsis: true, render: (v: string | null) => v ?? '-' },
              {
                title: 'Trạng thái',
                dataIndex: 'status',
                width: 110,
                align: 'center' as const,
                render: (v: string) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v] ?? v}</Tag>,
              },
              {
                title: 'Người duyệt',
                key: 'approver',
                width: 150,
                render: (_: unknown, r: LeaveRequest) => r.approver?.fullName ?? '-',
              },
              {
                title: 'Thao tác',
                key: 'actions',
                width: 200,
                render: (_: unknown, r: LeaveRequest) => {
                  const isOwn = meId != null && r.userId === meId;
                  return (
                    <Space>
                      {canDecide && r.status === 'pending' && !isOwn && (
                        <>
                          <Button
                            size="small"
                            type="primary"
                            icon={<CheckOutlined />}
                            onClick={() => { setDeciding({ id: r.id, approve: true }); setNote(''); setDecideOpen(true); }}
                          >
                            Duyệt
                          </Button>
                          <Button
                            size="small"
                            danger
                            icon={<CloseOutlined />}
                            onClick={() => { setDeciding({ id: r.id, approve: false }); setNote(''); setDecideOpen(true); }}
                          >
                            Từ chối
                          </Button>
                        </>
                      )}
                      {r.status === 'pending' && (isOwn || canDecide) && (
                        <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); setModalOpen(true); }}>
                          Sửa
                        </Button>
                      )}
                      {r.status === 'pending' && (isOwn || canDelete) && (
                        <Popconfirm title="Xóa đơn này?" onConfirm={() => handleDelete(r.id)} okText="Xóa" cancelText="Hủy">
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      )}
                    </Space>
                  );
                },
              },
            ]}
          />
        </>
      )}

      <LeaveRequestFormModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => load(status, page)}
      />

      <Modal
        open={decideOpen}
        title={deciding?.approve ? 'Duyệt đơn nghỉ phép' : 'Từ chối đơn nghỉ phép'}
        onCancel={() => setDecideOpen(false)}
        onOk={handleDecide}
        okText={deciding?.approve ? 'Duyệt' : 'Từ chối'}
        okButtonProps={{ danger: !deciding?.approve, type: deciding?.approve ? 'primary' : 'default' }}
        confirmLoading={decidingNow}
        destroyOnHidden
      >
        <Input.TextArea
          rows={3}
          placeholder="Ghi chú duyệt (tùy chọn)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
      </Modal>
    </div>
  );
}
