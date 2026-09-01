'use client';
// Trang in Debit Note khớp mẫu cũ I.H.T (ảnh): header công ty + bảng RECEIVE + bảng vận chuyển + bảng items + chữ ký. Dùng window.print().
import { Suspense, useEffect, useState } from 'react';
import { Button, Empty, Spin } from 'antd';
import { PrinterOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface CustomerRef {
  id: number;
  customerName: string;
  companyName: string;
  address: string | null;
  phone: string | null;
  fax: string | null;
  contactPerson: string | null;
}

interface DebitNoteItem {
  id: number;
  type: string;
  invoiceNumber: string | null;
  description: string | null;
  unit: string | null;
  currency: string;
  quantity: string | null;
  priceVnd: string | null;
  priceUsd: string | null;
  exchangeRate: string | null;
  taxRate: string | null;
  total: string | null;
}

interface SheetWithDebits {
  id: number;
  sheetNumber: string;
  containerNumber: string | null;
  containerQuantity: number | null;
  customer: CustomerRef | null;
  fromLocation: string | null;
  toLocation: string | null;
  etaDate: string | null;
  createdAt: string;
  nw: string | null;
  gw: string | null;
  customNo: string | null;
  declarationDate: string | null;
  billNumber: string | null;
  invoiceNumber: string | null;
  pol: string | null;
  pod: string | null;
  note: string | null;
  docStaff: { id: number; fullName: string } | null;
  deliveryStaff: { id: number; fullName: string } | null;
  debitNotes: DebitNoteItem[];
}

// Chuẩn tiền x100: DB lưu *100 (VD: 100.50 -> 10050), hiển thị chia 100
const MONEY_SCALE = 100;
function fmtMoney(v: string | number | null | undefined) {
  if (v == null || v === '') return '-';
  const n = Number(v);
  return Number.isNaN(n) ? '-' : (n / MONEY_SCALE).toLocaleString('vi-VN');
}
function fmtMoneyWeight(v: string | number | null | undefined) {
  if (v == null || v === '') return '-';
  const n = Number(v);
  return Number.isNaN(n) ? '-' : n.toLocaleString('vi-VN');
}
function fmtQty(v: string | null | undefined) {
  if (v == null || v === '') return '-';
  const n = Number(v);
  return Number.isNaN(n) ? '-' : n.toLocaleString('vi-VN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function fmtPrice(v: string | null | undefined) {
  if (v == null || v === '') return '-';
  const n = Number(v);
  return Number.isNaN(n) ? '-' : (n / MONEY_SCALE).toLocaleString('vi-VN');
}
// Định dạng ngày YYYY/MM/DD
function fmtDateSlash(v: string | null | undefined) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${dd}`;
}
// Định dạng ngày YYYY/MM/DD
function fmtDateSlashToday() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

// Tính VAT trên giá trị đã chia 100 (DB lưu *100)
function computeVat(d: DebitNoteItem) {
  const qty = Number(d.quantity ?? 1);
  const taxRate = Number(d.taxRate ?? 0);
  let unitPrice = 0;
  if (d.currency === 'USD') {
    unitPrice = Number(d.priceUsd ?? 0) / MONEY_SCALE * Number(d.exchangeRate ?? 0);
  } else {
    unitPrice = Number(d.priceVnd ?? 0) / MONEY_SCALE;
  }
  if (unitPrice === 0 && d.total != null) {
    const total = Number(d.total) / MONEY_SCALE;
    const pretax = taxRate ? total / (1 + taxRate / 100) : total;
    return Math.round((total - pretax) * 100) / 100;
  }
  const pretax = unitPrice * qty;
  return Math.round(pretax * (taxRate / 100) * 100) / 100;
}

// Component in một phiếu (layout khớp mẫu cũ)
function DebitDocument({ sheet }: { sheet: SheetWithDebits }) {
  const todaySlash = fmtDateSlashToday();
  let totalVat = 0;
  let totalAmt = 0;
  sheet.debitNotes.forEach((d) => {
    totalVat += computeVat(d);
    totalAmt += Number(d.total ?? 0);
  });

  const contactName = sheet.docStaff?.fullName ?? sheet.deliveryStaff?.fullName ?? '-';
  const customer = sheet.customer;

  return (
    <div className="print-sheet">
      {/* Header */}
      <div className="old-header">
        <div className="old-company">I.H.T VIET NAM CO., LTD</div>
        <div className="old-addr">Add: 108 Ý Lan, Phường Phú Thạnh, TP.HCM</div>
        <div className="old-contact">Tel: 08-38380888 / 08-39225100 ; Fax:08-39225105 /08-39225106</div>
        <div className="old-title">DEBIT NOTE</div>
      </div>

      {/* RECEIVE box */}
      <table className="old-table">
        <tbody>
          <tr>
            <th colSpan={2} className="old-th-center">RECEIVE</th>
            <td className="old-label">Date:</td>
            <td className="old-val-bold">{todaySlash}</td>
          </tr>
          <tr>
            <td className="old-label-sm">To:</td>
            <td className="old-val">{customer?.companyName ?? '-'}</td>
            <td className="old-label">Debit Note No:</td>
            <td className="old-val-bold">{sheet.sheetNumber}</td>
          </tr>
          <tr>
            <td className="old-label-sm">Attn:</td>
            <td className="old-val">{customer?.contactPerson ?? '-'}</td>
            <td className="old-label">Please Contact With:</td>
            <td className="old-val-bold">{contactName}</td>
          </tr>
          <tr>
            <td className="old-label-sm">Add:</td>
            <td className="old-val">{customer?.address ?? '-'}</td>
            <td className="old-label">Accountting:</td>
            <td className="old-val-bold">2123123</td>
          </tr>
          <tr>
            <td className="old-label-sm">Tel:</td>
            <td className="old-val">{customer?.phone ?? '-'}</td>
            <td className="old-label" style={{ borderBottom: '1px solid #000' }}></td>
            <td style={{ borderBottom: '1px solid #000' }}></td>
          </tr>
          <tr>
            <td className="old-label-sm">Fax:</td>
            <td className="old-val">{customer?.fax ?? '-'}</td>
            <td className="old-label" style={{ borderBottom: '1px solid #000' }}></td>
            <td style={{ borderBottom: '1px solid #000' }}></td>
          </tr>
        </tbody>
      </table>

      <div className="old-note">We would like to make the Debit Note as follows:</div>

      {/* Details box */}
      <table className="old-table">
        <tbody>
          <tr>
            <td className="old-label">From:</td>
            <td className="old-val">{sheet.fromLocation ?? '-'}</td>
            <td className="old-label">To:</td>
            <td className="old-val">{sheet.toLocation ?? '-'}</td>
          </tr>
          <tr>
            <td className="old-label">Customs No:</td>
            <td className="old-val">{sheet.customNo ?? '-'}</td>
            <td className="old-label">Custom date:</td>
            <td className="old-val">{fmtDateSlash(sheet.declarationDate)}</td>
          </tr>
          <tr>
            <td className="old-label">NW:</td>
            <td className="old-val">{sheet.nw != null ? `${fmtMoneyWeight(sheet.nw)} KGS` : '-'}</td>
            <td className="old-label">GW:</td>
            <td className="old-val">{sheet.gw != null ? `${fmtMoneyWeight(sheet.gw)} KGS` : '-'}</td>
          </tr>
          <tr>
            <td className="old-label">Job Order:</td>
            <td className="old-val">{sheet.sheetNumber}</td>
            <td className="old-label">Note:</td>
            <td className="old-val">{sheet.note ?? '-'}</td>
          </tr>
          <tr>
            <td className="old-label">QTY:</td>
            <td className="old-val">{sheet.containerQuantity != null ? String(sheet.containerQuantity) : sheet.containerNumber ?? '-'}</td>
            <td className="old-label">Invoices No:</td>
            <td className="old-val">{sheet.invoiceNumber ?? '-'}</td>
          </tr>
          <tr>
            <td className="old-label">Po No:</td>
            <td className="old-val">-</td>
            <td className="old-label">Bill No:</td>
            <td className="old-val">{sheet.billNumber ?? '-'}</td>
          </tr>
          <tr>
            <td className="old-label">Container No:</td>
            <td className="old-val" colSpan={3}>{sheet.containerNumber ?? '-'}</td>
          </tr>
        </tbody>
      </table>

      {/* Items */}
      <table className="old-table">
        <thead>
          <tr>
            <th className="old-th">STT</th>
            <th className="old-th">Descriptions</th>
            <th className="old-th">Invoice No</th>
            <th className="old-th">Unit</th>
            <th className="old-th">Qty</th>
            <th className="old-th">Price</th>
            <th className="old-th">VAT Tax</th>
            <th className="old-th">Total Amt</th>
          </tr>
        </thead>
        <tbody>
          {sheet.debitNotes.map((d, idx) => {
            const vat = computeVat(d);
            let price = '-';
            if (d.currency === 'USD' && d.priceUsd) price = (Number(d.priceUsd) / MONEY_SCALE).toLocaleString('en-US');
            else if (d.priceVnd) price = fmtPrice(d.priceVnd);
            return (
              <tr key={d.id}>
                <td className="old-td-center">{idx + 1}</td>
                <td className="old-td">{d.description ?? d.type}</td>
                <td className="old-td">{d.invoiceNumber ?? ''}</td>
                <td className="old-td-center">{d.unit ?? ''}</td>
                <td className="old-td-right">{d.quantity != null ? fmtQty(d.quantity) : '-'}</td>
                <td className="old-td-right">{price}</td>
                <td className="old-td-right">{vat ? vat.toLocaleString('vi-VN') : '-'}</td>
                <td className="old-td-right">{fmtMoney(d.total)}</td>
              </tr>
            );
          })}
          <tr className="old-total-row">
            <td colSpan={6} className="old-td-right old-bold">JOB AMT</td>
            <td className="old-td-right old-bold">{totalVat ? totalVat.toLocaleString('vi-VN') : '-'}</td>
            <td className="old-td-right old-bold">{fmtMoney(String(totalAmt))}</td>
          </tr>
        </tbody>
      </table>

      <div className="old-footer-text">
        <div>We are looking forwards to reiveiving your payment in the soonest time.</div>
        <div>If you have further infomation, please do not hesitate to contact with us.</div>
        <div>Also you can settle the payment to:</div>
        <div>Banker name: NGÂN HÀNG Á CHÂU- CN CHỢ LỚN</div>
        <div>Account no: 162000589</div>
        <div>Account name: CTY TNHH TM DV VẬN CHUYỂN I.H.T VIỆT NAM</div>
      </div>

      <div className="old-sigs">
        <div className="old-sig">SALE</div>
        <div className="old-sig">ACCOUNTANT</div>
        <div className="old-sig">APPROVAL</div>
      </div>
    </div>
  );
}

// Lấy ids từ URL, fetch batch và tự động in
function PrintContent() {
  const params = useSearchParams();
  const [sheets, setSheets] = useState<SheetWithDebits[] | null>(null);
  const [error, setError] = useState('');
  const [printed, setPrinted] = useState(false);

  useEffect(() => {
    const ids = params.get('ids') ?? '';
    const idList = ids.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
    if (!idList.length) {
      setError('Không có phiếu nào được chọn');
      setSheets([]);
      return;
    }
    apiFetch<SheetWithDebits[]>(`/reports/debit/batch?ids=${ids}`)
      .then((res) => setSheets(res))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Không tải được phiếu');
        setSheets([]);
      });
  }, [params]);

  useEffect(() => {
    if (sheets && sheets.length > 0 && !printed) {
      const t = setTimeout(() => {
        window.print();
        setPrinted(true);
      }, 400);
      return () => clearTimeout(t);
    }
  }, [sheets, printed]);

  // Hàm handleClose: xử lý handleClose
  function handleClose() {
    window.close();
    window.setTimeout(() => {
      if (!window.closed) window.history.back();
    }, 200);
  }

  if (!sheets && !error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div className="no-print" style={{ padding: 12, background: '#f5f5f5', display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
          In Debit Note
        </Button>
        <Button icon={<ArrowLeftOutlined />} onClick={handleClose}>
          Đóng
        </Button>
        <span style={{ color: '#888', fontSize: 13 }}>
          Đang in {(sheets ?? []).length} phiếu: {(sheets ?? []).map((s) => s.sheetNumber).join(', ')}
        </span>
      </div>
      {error ? (
        <div style={{ padding: 40 }}>
          <Empty description={error} />
        </div>
      ) : (
        (sheets ?? []).filter((s) => s.debitNotes.length > 0).map((s) => <DebitDocument key={s.id} sheet={s} />)
      )}
      <style>{`
        body { background: #fff; font-family: "Times New Roman", Times, serif; }
        .print-sheet { margin: 0 auto; padding: 12px 18px; max-width: 800px; color: #000; }
        .old-header { text-align: center; margin-bottom: 6px; }
        .old-company { font-size: 18px; font-weight: 700; }
        .old-addr { font-size: 12px; font-weight: 600; }
        .old-contact { font-size: 12px; font-weight: 600; }
        .old-title { font-size: 22px; font-weight: 700; margin-top: 10px; margin-bottom: 8px; letter-spacing: 1px; }
        .old-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 6px; }
        .old-table th, .old-table td { border: 1px solid #000; padding: 3px 6px; vertical-align: top; }
        .old-th-center { text-align: center; font-weight: 700; background: #fff; font-size: 12px; }
        .old-th { text-align: center; font-weight: 700; background: #fff; font-size: 11px; white-space: nowrap; }
        .old-label { font-weight: 700; white-space: nowrap; width: 110px; background: #fff; font-size: 12px; }
        .old-label-sm { font-weight: 700; white-space: nowrap; width: 45px; background: #fff; font-size: 12px; }
        .old-val { font-size: 12px; }
        .old-val-bold { font-size: 12px; font-weight: 700; }
        .old-note { font-size: 12px; font-weight: 700; margin: 6px 0 4px; text-decoration: underline; }
        .old-td { font-size: 11px; }
        .old-td-center { font-size: 11px; text-align: center; }
        .old-td-right { font-size: 11px; text-align: right; white-space: nowrap; }
        .old-total-row td { font-weight: 700; background: #fff; border-top: 2px solid #000; }
        .old-bold { font-weight: 700; }
        .old-footer-text { font-size: 12px; line-height: 1.45; margin-top: 6px; font-weight: 600; }
        .old-sigs { display: flex; justify-content: space-between; margin-top: 28px; text-align: center; }
        .old-sig { width: 33%; font-size: 12px; font-weight: 700; }
        @media print {
          @page { margin: 8mm 10mm; }
          .no-print { display: none !important; }
          .print-sheet { max-width: 100%; padding: 0; }
          .print-sheet { page-break-after: always; break-after: page; }
          .print-sheet:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>
    </div>
  );
}

export default function PrintDebitNotesPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
          <Spin size="large" />
        </div>
      }
    >
      <PrintContent />
    </Suspense>
  );
}
