'use client';
// Trang in Debit Note khớp mẫu cũ I.H.T (ảnh): header công ty + bảng RECEIVE + bảng vận chuyển + bảng items + chữ ký. Dùng window.print().
import { Suspense, useEffect, useState } from 'react';
import { Button, Empty } from 'antd';
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
  docStaff: { id: number; fullName: string; phone: string | null } | null;
  deliveryStaff: { id: number; fullName: string; phone: string | null } | null;
  carrier: { id: number; carrierName: string; companyName: string } | null;
  advanceVouchers?: Array<{
    id: number;
    type: string;
    items: Array<{ amount: string | number; kind?: string | null }>;
  }>;
  debitNotes: DebitNoteItem[];
}

// Chuẩn tiền x100: DB lưu *100 (VD: 100.50 -> 10050), hiển thị chia 100
const MONEY_SCALE = 100;
// Định dạng ngày DD/MM/YYYY (khớp mẫu debit cũ)
function fmtDateDMY(v: string | null | undefined) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
// Số tiền chuẩn Việt: 6.849.000 (dấu chấm nghìn, phẩy thập phân)
function fmtVi(v: string | number | null | undefined, scale = 100) {
  if (v == null || v === '') return '-';
  const n = Number(v) / scale;
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
// Cân nặng chuẩn Việt: 19.928
function fmtWt(v: string | number | null | undefined) {
  if (v == null || v === '') return '-';
  const n = Number(v);
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
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

// Header chung 1 lần đầu: công ty + RECEIVE (lấy khách hàng job đầu, ngày = ngày in)
function DebitDocHeader({ sheet }: { sheet: SheetWithDebits }) {
  const customer = sheet.customer;
  const contactName = sheet.deliveryStaff?.fullName ?? sheet.docStaff?.fullName ?? '-';
  const contactPhone = (sheet.deliveryStaff?.phone ?? sheet.docStaff?.phone) || '-';
  const d = new Date();
  const today = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return (
    <>
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
            <td className="old-val-bold">{today}</td>
          </tr>
          <tr>
            <td className="old-label-sm">To:</td>
            <td className="old-val">{customer?.companyName ?? '-'}</td>
            <td className="old-label">Please Contact With:</td>
            <td className="old-val-bold">{contactName}</td>
          </tr>
          <tr>
            <td className="old-label-sm">Attn:</td>
            <td className="old-val">{customer?.contactPerson ?? '-'}</td>
            <td className="old-label">Accountting:</td>
            <td className="old-val-bold">{contactPhone}</td>
          </tr>
          <tr>
            <td className="old-label-sm">Add:</td>
            <td className="old-val" colSpan={3}>{customer?.address ?? '-'}</td>
          </tr>
          <tr>
            <td className="old-label-sm">Tel:</td>
            <td className="old-val">{customer?.phone ?? '-'}</td>
            <td className="old-label"></td>
            <td></td>
          </tr>
          <tr>
            <td className="old-label-sm">Fax:</td>
            <td className="old-val">{customer?.fax ?? '-'}</td>
            <td className="old-label"></td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

// Footer chung 1 lần cuối: TOTAL AMT tổng + bank + chữ ký
function DebitDocFooter({ pretax, vat, total }: { pretax: number; vat: number; total: number }) {
  const f = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  return (
    <>
      <table className="old-table">
        <tbody>
          <tr className="old-total-row">
            <td colSpan={5} className="old-td-right old-bold">TOTAL AMT</td>
            <td className="old-td-right old-bold">{f(pretax)}</td>
            <td className="old-td-right old-bold">{vat ? f(vat) : '-'}</td>
            <td className="old-td-right old-bold">{f(total)}</td>
          </tr>
        </tbody>
      </table>

      <div className="old-footer-text">
        <div>We are looking forwards to reveiving your payment in the soonest time.</div>
        <div>If you have further infomation, please do not hesitate to contact with us.</div>
        <div>Also you can settle the payment to:</div>
        <div>Banker name: NGÂN HÀNG Á CHÂU- PGD TẠ UYÊN</div>
        <div>Account no: 162000589</div>
        <div>Account name: CTY TNHH TM DV VẬN CHUYỂN I.H.T VIỆT NAM</div>
      </div>

      <div className="old-sigs">
        <div className="old-sig">SALE</div>
        <div className="old-sig">ACCOUNTANT</div>
        <div className="old-sig">APPROVAL</div>
      </div>
    </>
  );
}

// Component in một phiếu (layout khớp mẫu debit cũ: đầu + cuối chỉ 1 lần,
// sang trang chỉ lặp dòng items, không lặp header/footer)
// Nhiều job: 1 header chung + RECEIVE đầu, mỗi job 1 khối info + bảng items + JOB AMT,
// cuối cùng TOTAL AMT tổng + bank + chữ ký
function JobDebitBlock({ sheet }: { sheet: SheetWithDebits }) {
  let totalVat = 0;
  let totalAmt = 0;
  sheet.debitNotes.forEach((d) => {
    totalVat += computeVat(d);
    totalAmt += Number(d.total ?? 0) / MONEY_SCALE;
  });
  totalVat = Math.round(totalVat * 100) / 100;
  totalAmt = Math.round(totalAmt * 100) / 100;
  const pretaxTotal = Math.round((totalAmt - totalVat) * 100) / 100;
  // CHI HỘ = tổng tạm ứng (Chi tạm ứng, chỉ khoản Chi)
  const tamUng = Math.round(
    (sheet.advanceVouchers ?? [])
      .filter((v) => v.type === 'Chi tạm ứng')
      .reduce(
        (sum, v) => sum + (v.items ?? []).filter((it: any) => it.kind !== 'Giảm trừ').reduce((s, it: any) => s + Number(it.amount ?? 0), 0),
        0,
      ) / 100 * 100,
  ) / 100;
  const serviceFee = Math.round((totalAmt - tamUng) * 100) / 100;

// Khối 1 job: info + items + JOB AMT (STT đếm lại từ 1 mỗi job)
  return (
    <>
      {/* Details box */}
      <table className="old-table old-plain">
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
            <td className="old-label">Custom Date:</td>
            <td className="old-val">{fmtDateDMY(sheet.declarationDate)}</td>
          </tr>
          <tr>
            <td className="old-label">NW:</td>
            <td className="old-val">{sheet.nw != null ? fmtWt(sheet.nw) : '-'}</td>
            <td className="old-label">GW:</td>
            <td className="old-val">{sheet.gw != null ? fmtWt(sheet.gw) : '-'}</td>
          </tr>
          <tr>
            <td className="old-label">Job Order:</td>
            <td className="old-val">{sheet.sheetNumber}</td>
            <td className="old-label">Note:</td>
            <td className="old-val">{sheet.carrier?.carrierName ?? sheet.note ?? '-'}</td>
          </tr>
          <tr>
            <td className="old-label">QTY:</td>
            <td className="old-val">{sheet.containerQuantity != null ? String(sheet.containerQuantity) : sheet.containerNumber ?? '-'}</td>
            <td className="old-label">Invoices No:</td>
            <td className="old-val">-</td>
          </tr>
          <tr>
            <td className="old-label">Po No:</td>
            <td className="old-val">{sheet.billNumber ?? '-'}</td>
            <td className="old-label">Bill No:</td>
            <td className="old-val">{sheet.billNumber ?? '-'}</td>
          </tr>
          <tr>
            <td className="old-label">Container No:</td>
            <td className="old-val" colSpan={3}>{sheet.containerNumber ?? '-'}</td>
          </tr>
        </tbody>
      </table>

      {/* Items: header là dòng tbody đầu để sang trang không lặp lại */}
      <table className="old-table">
        <tbody>
          <tr>
            <td className="old-th">STT</td>
            <td className="old-th">Descriptions</td>
            <td className="old-th">Invoice No</td>
            <td className="old-th">Unit</td>
            <td className="old-th">Qty</td>
            <td className="old-th">Price</td>
            <td className="old-th">VAT Tax</td>
            <td className="old-th">Total Amt</td>
          </tr>
          {sheet.debitNotes.map((d, idx) => {
            const vat = computeVat(d);
            let price = '-';
            if (d.currency === 'USD' && d.priceUsd) price = (Number(d.priceUsd) / MONEY_SCALE * Number(d.exchangeRate ?? 0)).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
            else if (d.priceVnd) price = fmtVi(d.priceVnd);
            return (
              <tr key={d.id}>
                <td className="old-td-center">{idx + 1}</td>
                <td className="old-td">{d.description ?? d.type}</td>
                <td className="old-td">{d.invoiceNumber ?? ''}</td>
                <td className="old-td-center">{d.unit ?? ''}</td>
                <td className="old-td-right">{d.quantity != null ? Number(d.quantity).toLocaleString('en-US') : '-'}</td>
                <td className="old-td-right">{price}</td>
                <td className="old-td-right">{vat ? vat.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : '-'}</td>
                <td className="old-td-right">{fmtVi(d.total)}</td>
              </tr>
            );
          })}
          <tr className="old-total-row">
            <td colSpan={6} className="old-td-right old-bold">JOB AMT</td>
            <td className="old-td-right old-bold">{totalVat ? totalVat.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : '-'}</td>
            <td className="old-td-right old-bold">{totalAmt.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</td>
          </tr>
          <tr className="old-total-row old-yellow-row">
            <td colSpan={5} className="old-td-right old-bold">TỔNG CỘNG 合計</td>
            <td className="old-td-right old-bold">{pretaxTotal.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</td>
            <td className="old-td-right old-bold">{totalVat ? totalVat.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : '-'}</td>
            <td className="old-td-right old-bold">{totalAmt.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</td>
          </tr>
          {tamUng > 0 && (
            <>
              <tr>
                <td colSpan={7} className="old-td-right old-bold">CHI HỘ 代墊費</td>
                <td className="old-td-right old-bold">{tamUng.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td colSpan={7} className="old-td-right old-bold">PHÍ DỊCH VỤ IHT - 服務費</td>
                <td className="old-td-right old-bold">{serviceFee.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>

    </>
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', fontSize: 16 }}>
        Đang tải phiếu để in, vui lòng chờ...
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
        (() => {
          const validSheets = (sheets ?? []).filter((s) => s.debitNotes.length > 0);
          let gVat = 0;
          let gTotal = 0;
          validSheets.forEach((s) =>
            s.debitNotes.forEach((d) => {
              gVat += computeVat(d);
              gTotal += Number(d.total ?? 0) / MONEY_SCALE;
            }),
          );
          gVat = Math.round(gVat * 100) / 100;
          gTotal = Math.round(gTotal * 100) / 100;
          if (!validSheets.length) return null;
          return (
            <div className="print-sheet">
              <DebitDocHeader sheet={validSheets[0]} />
              {validSheets.map((s) => (
                <JobDebitBlock key={s.id} sheet={s} />
              ))}
              <DebitDocFooter
                pretax={Math.round((gTotal - gVat) * 100) / 100}
                vat={gVat}
                total={gTotal}
              />
            </div>
          );
        })()
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
        .old-table.old-plain td { border: none; padding: 1px 6px; }
        .old-yellow-row td { background: #ffff00; }
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
          /* Đầu + cuối chỉ in 1 lần, sang trang chỉ lặp dòng items */
          tr { page-break-inside: avoid; }
          /* In giấy: ép chữ đen đậm, tránh chữ xám in ra nhạt */
          .print-sheet, .print-sheet * { color: #000 !important; }
        }
      `}</style>
    </div>
  );
}

export default function PrintDebitNotesPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', fontSize: 16 }}>
          Đang tải phiếu để in, vui lòng chờ...
        </div>
      }
    >
      <PrintContent />
    </Suspense>
  );
}
