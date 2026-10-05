'use client';
// Trang in Phiếu thu khớp mẫu cũ: header công ty + SỐ PHIẾU / PHIẾU THU / người nộp + tiền + phí CK / 5 ô ký. Dùng batch?ids=.
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { apiFetch } from '@/lib/api';

interface ReceiptVoucher {
  id: number;
  receiptNo: string;
  payerType: string;
  receiptDate: string;
  currency: string;
  customer: { id: number; companyName: string; customerName: string; address?: string | null } | null;
  payerName: string | null;
  payerDisplay: string;
  createdBy: { id: number; fullName: string } | null;
  staff: { id: number; fullName: string } | null;
  amount: number | string;
  transFee: number | string | null;
  note: string | null;
}

// Định dạng ngày DD-MM-YYYY (khớp mẫu cũ)
function fmtDateDash(v: string | null | undefined) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}
// Chuẩn tiền x100: DB lưu *100, hiển thị chia 100
const MONEY_SCALE = 100;
function fmtMoney(v: string | number | null | undefined) {
  if (v == null || v === '') return '0';
  const n = Number(v);
  return Number.isNaN(n) ? '0' : (n / MONEY_SCALE).toLocaleString('vi-VN');
}

// Component in một phiếu (layout khớp mẫu cũ)
function VoucherDocument({ v }: { v: ReceiptVoucher }) {
  const payer = v.payerDisplay || v.payerName || '';
  const address = v.customer?.address ?? '';

  return (
    <div className="print-sheet">
      <div className="old-top">
        <div className="old-company">
          <div className="old-co-name">I.H.T VIET NAM CO., LTD</div>
          <div>Add: 108 Ý Lan, Phường Phú Thạnh, TP.HCM</div>
          <div>Tel: 08-38380888 / 08-39225100 ; Fax: 08-39225105 / 08-39225106</div>
        </div>
        <div className="old-receipt-no">SỐ PHIẾU: {v.receiptNo}</div>
      </div>

      <div className="old-header">
        <div className="old-title">PHIẾU THU</div>
        <div className="old-date">{fmtDateDash(v.receiptDate)}</div>
      </div>

      <div className="old-lines">
        <div className="old-line"><span className="old-k">Người Nộp Tiền:</span> <strong>{payer}</strong></div>
        <div className="old-line"><span className="old-k">Địa Chỉ:</span> <strong>{address}</strong></div>
        <div className="old-line"><span className="old-k">Lý Do Nộp:</span> <strong>{v.note ?? ''}</strong></div>
        <div className="old-line old-money">
          <span><span className="old-k">Số tiền:</span> <strong>{fmtMoney(v.amount)} {v.currency}</strong></span>
          <span><span className="old-k">Phí Chuyển Khoản:</span> <strong>{fmtMoney(v.transFee)} {v.currency}</strong></span>
        </div>
        <div className="old-line old-money">
          <span className="old-k">Kèm Theo:..................................................................</span>
          <span className="old-k">Chứng Từ Gốc</span>
        </div>
      </div>

      {/* Chữ ký: Người Lập Phiếu, Người Nộp Tiền, Thủ Quỹ, Kế Toán Trưởng, Giám Đốc */}
      <table className="old-table" style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th className="old-th" style={{ width: '20%' }}>Người Lập Phiếu<br /><span className="old-sub">(Ký, họ tên)</span></th>
            <th className="old-th" style={{ width: '20%' }}>Người Nộp Tiền<br /><span className="old-sub">(Ký, họ tên)</span></th>
            <th className="old-th" style={{ width: '20%' }}>Thủ Quỹ<br /><span className="old-sub">(Ký, họ tên)</span></th>
            <th className="old-th" style={{ width: '20%' }}>Kế Toán Trưởng<br /><span className="old-sub">(Ký, họ tên)</span></th>
            <th className="old-th">Giám Đốc<br /><span className="old-sub">(Ký, họ tên, đóng dấu)</span></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="old-td sig-cell"></td>
            <td className="old-td sig-cell"></td>
            <td className="old-td sig-cell"></td>
            <td className="old-td sig-cell"></td>
            <td className="old-td sig-cell"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Lấy ids từ URL, fetch batch và tự động in
function PrintReceiptVouchersContent() {
  const searchParams = useSearchParams();
  const [vouchers, setVouchers] = useState<ReceiptVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const printedRef = useRef(false);

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
    apiFetch<ReceiptVoucher[]>(`/receipt-vouchers/batch?ids=${idList.join(',')}`)
      .then(setVouchers)
      .catch(() => setVouchers([]))
      .finally(() => setLoading(false));
  }, [searchParams]);

  useEffect(() => {
    if (!loading && vouchers.length && !printedRef.current) {
      printedRef.current = true;
      // chờ font + render ổn định rồi mới mở hộp thoại in
      const t = setTimeout(() => window.print(), 1000);
      return () => clearTimeout(t);
    }
  }, [loading, vouchers]);

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;
  if (!vouchers.length) return <div style={{ padding: 24 }}>Không có dữ liệu để in</div>;

  return (
    <div className="print-wrap" style={{ padding: 12, background: '#fff' }}>
      <div className="no-print" style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
        .old-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .old-co-name { font-weight: 700; font-size: 15px; }
        .old-company { font-size: 12px; font-weight: 700; }
        .old-receipt-no { font-weight: 700; font-size: 15px; white-space: nowrap; }
        .old-header { text-align: center; margin-bottom: 12px; }
        .old-title { font-size: 22px; font-weight: 700; }
        .old-date { font-size: 13px; margin-top: 2px; }
        .old-lines { font-size: 13px; }
        .old-line { margin-bottom: 6px; }
        .old-k { font-weight: 400; }
        .old-money { display: flex; justify-content: space-between; gap: 24px; }
        .old-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .old-table th, .old-table td { border: 1px solid #000; padding: 3px 6px; vertical-align: top; }
        .old-th { text-align: center; font-weight: 700; font-size: 12px; background: #fff; }
        .old-sub { font-weight: 400; font-size: 10px; font-style: italic; }
        .old-td { font-size: 11px; }
        .sig-cell { height: 90px; }
        @media print {
          @page { size: A4 portrait; margin: 12mm 15mm; }
          body { margin: 0; }
          .no-print { display: none !important; }
          .print-wrap { padding: 0 !important; }
          .page-break { page-break-after: always; break-after: page; }
          .print-sheet { max-width: 180mm !important; margin: 0 auto !important; }
          .print-sheet, .print-sheet * { color: #000 !important; }
        }
      `}</style>
    </div>
  );
}

export default function PrintReceiptVouchersPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', fontSize: 16 }}>
          Đang tải phiếu để in, vui lòng chờ...
        </div>
      }
    >
      <PrintReceiptVouchersContent />
    </Suspense>
  );
}
