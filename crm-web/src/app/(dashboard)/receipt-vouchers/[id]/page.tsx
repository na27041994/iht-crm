'use client';

import { useCallback, useEffect, useState } from 'react';
import { App, Breadcrumb, Button, Card, Descriptions, Empty, Typography } from 'antd';
import { EditOutlined, PrinterOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import ReceiptVoucherFormModal from '@/components/ReceiptVoucherFormModal';

interface ReceiptVoucher {
  id: number;
  receiptNo: string;
  payerType: string;
  receiptDate: string;
  currency: string;
  customer: { id: number; customerName: string; companyName: string; address?: string | null } | null;
  payerName: string | null;
  payerDisplay: string;
  createdBy: { id: number; fullName: string } | null;
  staff: { id: number; fullName: string } | null;
  amount: number | string;
  transFee: number | string | null;
  note: string | null;
}

const MONEY_SCALE = 100;
function fmtMoney(v: number | string | null | undefined) {
  if (v == null || v === '') return '-';
  const n = Number(v);
  if (Number.isNaN(n)) return '-';
  return new Intl.NumberFormat('vi-VN').format(n / MONEY_SCALE);
}

export default function ReceiptVoucherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { message } = App.useApp();
  const [voucher, setVoucher] = useState<ReceiptVoucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const v = await apiFetch<ReceiptVoucher>(`/receipt-vouchers/${id}`);
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

  if (loading) {
    return <Card loading style={{ minHeight: 200 }} />;
  }

  if (!voucher) {
    return (
      <Card>
        <Empty description="Không tìm thấy phiếu thu" />
      </Card>
    );
  }

  const info = [
    { label: 'Receipt No', value: voucher.receiptNo },
    { label: 'Đối tượng', value: voucher.payerType },
    { label: 'Ngày thu', value: new Date(voucher.receiptDate).toLocaleDateString('vi-VN') },
    { label: 'Nhân viên tạo', value: voucher.createdBy?.fullName },
    { label: 'NV thu', value: voucher.staff?.fullName ?? voucher.createdBy?.fullName },
    {
      label: 'Người nộp',
      value: voucher.payerDisplay || '-',
    },
    { label: 'Current', value: voucher.currency },
    { label: 'Số tiền', value: fmtMoney(voucher.amount) },
    { label: 'Phí chuyển khoản', value: fmtMoney(voucher.transFee) },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Breadcrumb
            style={{ marginBottom: 8 }}
            items={[{ title: <Link href="/receipt-vouchers">Phiếu thu</Link> }, { title: voucher.receiptNo }]}
          />
          <Typography.Title level={3} style={{ margin: 0 }}>
            Phiếu {voucher.receiptNo}
          </Typography.Title>
        </div>
        <div className="flex gap-2">
          <Button icon={<PrinterOutlined />} onClick={() => window.open(`/print/receipt-vouchers?ids=${voucher.id}`, '_blank')}>
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
            <strong>Lý do nộp:</strong> {voucher.note}
          </Typography.Paragraph>
        )}
      </Card>

      <ReceiptVoucherFormModal
        open={formOpen}
        editingId={voucher.id}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />
    </div>
  );
}
