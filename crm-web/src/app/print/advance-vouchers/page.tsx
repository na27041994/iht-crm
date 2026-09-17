'use client';
// Trang in Phiếu chi trực tiếp khớp mẫu cũ: header PHIẾU CHI TRỰC TIẾP / bảng thông tin 4 hàng / bảng tiền + tổng / 6 ô ký. Dùng batch?ids=.
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Spin } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { apiFetch } from '@/lib/api';

interface AdvanceVoucher {
  id: number;
  advanceNo: string;
  type: string;
  advanceDate: string;
  currency: string;
  orderFrom: string | null;
  orderTo: string | null;
  containerQty: number | null;
  qty: string | null;
  note: string | null;
  customer: { id: number; companyName: string; customerName: string } | null;
  sheet: { id: number; sheetNumber: string } | null;
  createdBy: { id: number; fullName: string } | null;
  totalAmount?: number;
  items: { id: number; amount: string; note: string | null }[];
}

// Định dạng ngày YYYY/MM/DD
function fmtDateSlash(v: string | null | undefined) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}
// Chuẩn tiền x100: DB lưu *100, hiển thị chia 100
const MONEY_SCALE = 100;
function fmtMoney(v: string | number | null | undefined) {
  if (v == null || v === '') return '0';
  const n = Number(v);
  return Number.isNaN(n) ? '0' : (n / MONEY_SCALE).toLocaleString('vi-VN');
}

// Component in một phiếu (layout khớp mẫu cũ)
function VoucherDocument({ v }: { v: AdvanceVoucher }) {
  const total = v.totalAmount ?? v.items.reduce((s, it) => s + Number(it.amount ?? 0), 0);
  const custNo = v.customer ? String(v.customer.id) : '';
  const custName = v.customer ? v.customer.companyName || v.customer.customerName : '';
  const staffName = v.createdBy?.fullName ?? '';
  const staffShort = staffName ? staffName.toUpperCase().replace(/\s+/g, '') : '';
  // fallback short: BOITHANH style
  const personShort = staffShort || 'NV';
  const sheetNo = v.sheet?.sheetNumber ?? '';

  const typeUpper = (v.type || '').toUpperCase();
  const isTrucTiep = typeUpper.includes('TRỰC TIẾP');
  const title = isTrucTiep ? 'PHIẾU CHI TRỰC TIẾP' : typeUpper.includes('TẠM ỨNG') ? (v.type === 'Phiếu tạm ứng' ? 'PHIẾU TẠM ỨNG' : 'PHIẾU CHI TẠM ỨNG') : `PHIẾU ${typeUpper || 'CHI'}`;
  const subtitle = isTrucTiep ? 'APPLICANT' : 'ADVANCE PAYMENT';

  return (
    <div className="print-sheet">
      <div className="old-header">
        <div className="old-title">{title}</div>
        <div className="old-subtitle">{subtitle}</div>
      </div>

      {/* Info grid */}
      <table className="old-table">
        <tbody>
          <tr>
            <td className="old-label">Số Job:<br /><span className="old-label-en">Job No:</span></td>
            <td className="old-val">{sheetNo}</td>
            <td className="old-label">Loại:<br /><span className="old-label-en">Type:</span></td>
            <td className="old-val-bold">{v.type}</td>
            <td className="old-label">Số phiếu:<br /><span className="old-label-en">Advance No:</span></td>
            <td className="old-val-bold">{v.advanceNo}</td>
            <td className="old-label">Ngày tạo:<br /><span className="old-label-en">Advance Date:</span></td>
            <td className="old-val-bold">{fmtDateSlash(v.advanceDate)}</td>
          </tr>
          <tr>
            <td className="old-label">Nhân viên:<br /><span className="old-label-en">Advance Staff:</span></td>
            <td className="old-val-bold" style={{ whiteSpace: 'nowrap' }}>{staffName.toUpperCase()}</td>
            <td className="old-label">Mã Khách:<br /><span className="old-label-en">Cust No:</span></td>
            <td className="old-val">{custNo}</td>
            <td className="old-label" colSpan={2}>Tên Khách:<br /><span className="old-label-en">Cust Name:</span></td>
            <td className="old-val" colSpan={2}>{custName}</td>
          </tr>
          <tr>
            <td className="old-label">Loại tiền:<br /><span className="old-label-en">Currency:</span></td>
            <td className="old-val-bold">{v.currency}</td>
            <td className="old-label">Từ:<br /><span className="old-label-en">Order From:</span></td>
            <td className="old-val">{v.orderFrom ?? ''}</td>
            <td className="old-label">Đến:<br /><span className="old-label-en">Order To:</span></td>
            <td className="old-val">{v.orderTo ?? ''}</td>
            <td className="old-label">Số lượng:<br /><span className="old-label-en">Container Qty:</span></td>
            <td className="old-val">{v.containerQty ?? ''}</td>
          </tr>
          <tr>
            <td className="old-label">Lý do:<br /><span className="old-label-en">Reasons:</span></td>
            <td className="old-val-bold" colSpan={7}>{v.note ?? ''}</td>
          </tr>
        </tbody>
      </table>

      {/* Amount table */}
      <table className="old-table">
        <thead>
          <tr>
            <th className="old-th" style={{ width: 60 }}>STT</th>
            <th className="old-th">Số tiền/Amount</th>
            <th className="old-th">Nhân viên/Person</th>
            <th className="old-th">Ngày/Date</th>
            <th className="old-th">Ghi chú/Note</th>
          </tr>
        </thead>
        <tbody>
          {v.items.length ? (
            v.items.map((it, idx) => (
              <tr key={it.id}>
                <td className="old-td-center">{String(idx + 1).padStart(2, '0')}</td>
                <td className="old-td-right">{fmtMoney(it.amount)}</td>
                <td className="old-td-center">{personShort}</td>
                <td className="old-td-center">{fmtDateSlash(v.advanceDate)}</td>
                <td className="old-td">{it.note ?? ''}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="old-td-center">01</td>
              <td className="old-td-right">{fmtMoney(total)}</td>
              <td className="old-td-center">{personShort}</td>
              <td className="old-td-center">{fmtDateSlash(v.advanceDate)}</td>
              <td className="old-td"></td>
            </tr>
          )}
          <tr className="old-total-row">
            <td colSpan={5} className="old-td-center old-bold">TỔNG TIỀN / TOTAL AMOUNT: {fmtMoney(total)}</td>
          </tr>
        </tbody>
      </table>

      {/* Signatures: Người xin chi, Chủ quản đơn vị, Kế toán, Duyệt, Thủ quỹ, Người nhận tiền */}
      <table className="old-table" style={{ marginTop: 0 }}>
        <thead>
          <tr>
            <th className="old-th" style={{ width: '17%' }}>Người Xin Chi/<br />Applicant</th>
            <th className="old-th" style={{ width: '17%' }}>Chủ Quản Đơn Vị/<br />Department Manager</th>
            <th className="old-th" style={{ width: '16%' }}>Kế Toán/<br />Accountant</th>
            <th className="old-th" style={{ width: '16%' }}>Duyệt/<br />Approved by</th>
            <th className="old-th" style={{ width: '17%' }}>Thủ Quỹ/<br />Cashier</th>
            <th className="old-th">Người Nhận Tiền/<br />Receiver</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="old-td sig-cell" style={{ height: 60 }}></td>
            <td className="old-td sig-cell" style={{ height: 60 }}></td>
            <td className="old-td sig-cell" style={{ height: 60 }}></td>
            <td className="old-td sig-cell" style={{ height: 60 }}></td>
            <td className="old-td sig-cell" style={{ height: 60 }}></td>
            <td className="old-td sig-cell" style={{ height: 60 }}></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Lấy ids từ URL, fetch batch và tự động in
function PrintAdvanceVouchersContent() {
  const searchParams = useSearchParams();
  const [vouchers, setVouchers] = useState<AdvanceVoucher[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = searchParams.get('ids');
    if (!ids) {
      setLoading(false);
      return;
    }
    const idList = ids.split(',').map((s) => Number(s.trim())).filter((n) => n > 0);
    if (!idList.length) {
      setLoading(false);
      return;
    }
    apiFetch<AdvanceVoucher[]>(`/advance-vouchers/batch?ids=${idList.join(',')}`)
      .then(setVouchers)
      .catch(() => setVouchers([]))
      .finally(() => setLoading(false));
  }, [searchParams]);

  useEffect(() => {
    if (!loading && vouchers.length) {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [loading, vouchers]);

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;
  if (!vouchers.length) return <div style={{ padding: 24 }}>Không có dữ liệu để in</div>;

  return (
    <div style={{ padding: 12, background: '#fff' }}>
      <div className="no-print" style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
          In phiếu
        </Button>
        <Button onClick={() => window.close()}>Đóng</Button>
      </div>

      {vouchers.map((v, idx) => (
        <div key={v.id} className={idx < vouchers.length - 1 ? 'page-break' : ''} style={{ marginBottom: 16 }}>
          <VoucherDocument v={v} />
        </div>
      ))}

      <style>{`
        body { background: #fff; font-family: "Times New Roman", Times, serif; }
        .print-sheet { margin: 0 auto; max-width: 800px; color: #000; }
        .old-header { text-align: center; margin-bottom: 8px; }
        .old-title { font-size: 18px; font-weight: 700; }
        .old-subtitle { font-size: 14px; font-weight: 700; }
        .old-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 0; }
        .old-table th, .old-table td { border: 1px solid #000; padding: 3px 6px; vertical-align: top; }
        .old-th { text-align: center; font-weight: 700; font-size: 11px; background: #fff; }
        .old-label { font-weight: 700; white-space: nowrap; font-size: 11px; width: 85px; }
        .old-label-en { font-weight: 400; font-size: 10px; }
        .old-val { font-size: 11px; }
        .old-val-bold { font-size: 11px; font-weight: 700; }
        .old-td { font-size: 11px; }
        .old-td-center { font-size: 11px; text-align: center; }
        .old-td-right { font-size: 11px; text-align: right; }
        .old-total-row td { font-weight: 700; text-align: center; }
        .old-bold { font-weight: 700; }
        @media print {
          @page { size: A5 landscape; margin: 6mm 7mm; }
          .no-print { display: none !important; }
          .page-break { page-break-after: always; break-after: page; }
          .print-sheet { max-width: 100% !important; }
          .old-header { margin-bottom: 4px; }
          .old-title { font-size: 15px; }
          .old-subtitle { font-size: 12px; }
          .old-table { font-size: 10px; }
          .old-table th, .old-table td { padding: 2px 4px; }
          .old-label { width: 70px; }
        }
      `}</style>
    </div>
  );
}

export default function PrintAdvanceVouchersPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
          <Spin size="large" />
        </div>
      }
    >
      <PrintAdvanceVouchersContent />
    </Suspense>
  );
}
