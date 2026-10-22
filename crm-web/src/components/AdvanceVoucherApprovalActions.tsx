'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { App, Button, Input, Modal, Popconfirm, Space } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  DollarOutlined,
  InboxOutlined,
  PlayCircleOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { apiFetch } from '@/lib/api';
import { getMeId } from '@/lib/cachedApi';
import { usePermissions } from '@/hooks/usePermission';

export interface ApprovalVoucher {
  id: number;
  approvalStatus: string;
  createdById?: number | null;
  createdBy?: { id: number } | null;
  advanceStaffId?: number | null;
  advanceStaff?: { id: number } | null;
  rejectReason?: string | null;
}

interface Props {
  voucher: ApprovalVoucher;
  onChanged: () => void;
  size?: 'small' | 'middle';
}

export default function AdvanceVoucherApprovalActions({ voucher, onChanged, size = 'small' }: Props) {
  const { message } = App.useApp();
  const { can, isAdmin } = usePermissions();
  const [meId, setMeId] = useState<number | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMeId().then(setMeId).catch(() => {});
  }, []);

  const status = voucher.approvalStatus;
  const canApprove = can('advance_voucher', 'approve');
  const canPay = can('advance_voucher', 'pay');
  const canEdit = can('advance_voucher', 'edit');
  const isCreator = meId != null && (voucher.createdById === meId || voucher.createdBy?.id === meId);
  const isReceiver = meId != null && (voucher.advanceStaffId === meId || voucher.advanceStaff?.id === meId);

  async function run(path: string, note?: string) {
    setBusy(true);
    try {
      await apiFetch(`/advance-vouchers/${voucher.id}/${path}`, {
        method: 'POST',
        body: JSON.stringify({ note: note ?? null }),
      });
      message.success('Đã cập nhật trạng thái phiếu');
      onChanged();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setBusy(false);
    }
  }

  const buttons: ReactNode[] = [];

  if ((status === 'draft' || status === 'rejected') && (isCreator || canEdit)) {
    buttons.push(
      <Popconfirm
        key="submit"
        title="Trình duyệt phiếu này?"
        description="Sau khi trình, phiếu sẽ bị khóa và chuyển tới Trưởng bộ phận."
        onConfirm={() => run('submit')}
        okText="Trình duyệt"
        cancelText="Hủy"
      >
        <Button size={size} type="primary" icon={<PlayCircleOutlined />} loading={busy}>
          Trình duyệt
        </Button>
      </Popconfirm>,
    );
  }

  if ((status === 'pending_dept' || status === 'pending_accountant') && canApprove) {
    const step = status === 'pending_dept' ? 'approve-dept' : 'approve-accountant';
    const who = status === 'pending_dept' ? 'Trưởng bộ phận' : 'Kế toán';
    buttons.push(
      <Popconfirm
        key="approve"
        title={`${who} duyệt phiếu này?`}
        onConfirm={() => run(step)}
        okText="Duyệt"
        cancelText="Hủy"
      >
        <Button size={size} type="primary" icon={<CheckOutlined />} loading={busy}>
          Duyệt
        </Button>
      </Popconfirm>,
      <Button
        key="reject"
        size={size}
        danger
        icon={<CloseOutlined />}
        onClick={() => {
          setRejectNote('');
          setRejectOpen(true);
        }}
      >
        Từ chối
      </Button>,
    );
  }

  if (status === 'approved' && canPay) {
    buttons.push(
      <Popconfirm
        key="pay"
        title="Xác nhận đã chi tiền?"
        onConfirm={() => run('pay')}
        okText="Đã chi"
        cancelText="Hủy"
      >
        <Button size={size} type="primary" icon={<DollarOutlined />} loading={busy}>
          Xác nhận đã chi
        </Button>
      </Popconfirm>,
    );
  }

  if (status === 'paid' && (isReceiver || canApprove)) {
    buttons.push(
      <Popconfirm
        key="receive"
        title="Xác nhận đã nhận tiền?"
        onConfirm={() => run('receive')}
        okText="Đã nhận"
        cancelText="Hủy"
      >
        <Button size={size} type="primary" icon={<InboxOutlined />} loading={busy}>
          Xác nhận đã nhận
        </Button>
      </Popconfirm>,
    );
  }

  if (status !== 'draft' && isAdmin) {
    buttons.push(
      <Popconfirm
        key="reset"
        title="Mở khóa phiếu về trạng thái nháp?"
        description="Toàn bộ thông tin duyệt sẽ được xóa, lịch sử vẫn được giữ."
        onConfirm={() => run('admin-reset')}
        okText="Mở khóa"
        cancelText="Hủy"
      >
        <Button size={size} icon={<UnlockOutlined />} loading={busy}>
          Mở khóa
        </Button>
      </Popconfirm>,
    );
  }

  return (
    <>
      {buttons.length > 0 && (
        <Space wrap size={4}>
          {buttons}
        </Space>
      )}
      <Modal
        open={rejectOpen}
        title="Từ chối phiếu chi"
        okText="Từ chối"
        cancelText="Hủy"
        okButtonProps={{ danger: true, disabled: !rejectNote.trim() }}
        confirmLoading={busy}
        onOk={async () => {
          await run('reject', rejectNote);
          setRejectOpen(false);
        }}
        onCancel={() => setRejectOpen(false)}
        destroyOnHidden
      >
        <Input.TextArea
          rows={3}
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder="Nhập lý do từ chối (bắt buộc)"
        />
      </Modal>
    </>
  );
}
