'use client';

import { useRef, useState } from 'react';
import { Modal } from 'antd';
import TrackingSheetForm, { type TrackingSheetFormHandle, type TrackingSheetFormValues } from '@/components/TrackingSheetForm';

export type { TrackingSheetFormValues };

interface TrackingSheetFormModalProps {
  open: boolean;
  editingId: number | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function TrackingSheetFormModal({
  open,
  editingId,
  onClose,
  onSaved,
}: TrackingSheetFormModalProps) {
  const formRef = useRef<TrackingSheetFormHandle>(null);
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      open={open}
      title={editingId ? 'Sửa phiếu theo dõi' : 'Tạo phiếu theo dõi'}
      onCancel={onClose}
      onOk={() => formRef.current?.submit()}
      okText={editingId ? 'Lưu thay đổi' : 'Tạo phiếu'}
      confirmLoading={saving}
      width={720}
      destroyOnHidden
    >
      {open && (
        <TrackingSheetForm
          ref={formRef}
          editingId={editingId}
          onSavingChange={setSaving}
          onSaved={() => {
            onSaved();
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
