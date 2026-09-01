'use client';

import { Suspense, useEffect, useState } from 'react';
import { Button, Empty, Spin } from 'antd';
import { PrinterOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface StaffRef {
  id: number;
  fullName: string;
}

interface CustomerRef {
  id: number;
  customerName: string;
  companyName: string;
}

interface JobOrderItem {
  id: number;
  type: string;
  description: string | null;
  portAmt: string | null;
  industry: string | null;
  note: string | null;
}

interface JobBookingItem {
  id: number;
  type: string;
  description: string | null;
  unit: string | null;
  quantity: string | null;
  pretaxAmount: string | null;
  taxRate: string | null;
  taxAmount: string | null;
  afterTaxAmount: string | null;
  total: string | null;
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

interface TrackingSheet {
  id: number;
  sheetNumber: string;
  docStaff: StaffRef | null;
  deliveryStaff: StaffRef | null;
  nw: string | null;
  containerNumber: string | null;
  customer: CustomerRef | null;
  fromLocation: string | null;
  toLocation: string | null;
  containerQuantity: number | null;
  etaDate: string | null;
  gw: string | null;
  customNo: string | null;
  declarationDate: string | null;
  billNumber: string | null;
  invoiceNumber: string | null;
  pol: string | null;
  pod: string | null;
  note: string | null;
  createdAt: string;
  jobOrders: JobOrderItem[];
  jobBookings: JobBookingItem[];
  debitNotes: DebitNoteItem[];
}

// Định dạng số tiền/số lượng theo chuẩn vi-VN
function fmtMoney(v: string | null | undefined) {
  if (v == null || v === '') return '-';
  const n = Number(v);
  return Number.isNaN(n) ? '-' : n.toLocaleString('vi-VN');
}

// Hàm fmtNum: xử lý fmtNum
function fmtNum(v: string | null | undefined) {
  if (v == null || v === '') return '-';
  const n = Number(v);
  return Number.isNaN(n) ? '-' : n.toLocaleString('vi-VN');
}

// Định dạng ngày YYYY/MM/DD
function fmtDate(v: string | null | undefined) {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('vi-VN');
}

function pickSection<T extends { id: number; type: string }>(items: T[], filter: Set<number>, selectionMode: boolean): T[] {
  const sorted = [...items].sort((a, b) => a.type.localeCompare(b.type, 'vi') || a.id - b.id);
  if (!selectionMode) return sorted;
  return sorted.filter((x) => filter.has(x.id));
}

function groupClass<T extends { type: string }>(rows: T[], index: number) {
  return index > 0 && rows[index].type !== rows[index - 1].type ? 'group-start' : undefined;
}

// Hàm SheetDocument: xử lý SheetDocument
function SheetDocument({
  sheet,
  orderFilter,
  bookingFilter,
  debitFilter,
  selectionMode,
}: {
  sheet: TrackingSheet;
  orderFilter: Set<number>;
  bookingFilter: Set<number>;
  debitFilter: Set<number>;
  selectionMode: boolean;
}) {
  const orders = pickSection(sheet.jobOrders, orderFilter, selectionMode);
  const bookings = pickSection(sheet.jobBookings, bookingFilter, selectionMode);
  const debits = pickSection(sheet.debitNotes, debitFilter, selectionMode);

  return (
    <div className="print-sheet">
      <div className="doc-header">
        <div className="company-name">I.H.T LOGISTICS</div>
        <div className="company-sub">ĐƠN VỊ VẬN CHUYỂN QUỐC TẾ</div>
        <div className="doc-title">PHIẾU THEO DÕI VẬN CHUYỂN</div>
        <div className="doc-no">Mã phiếu: {sheet.sheetNumber}</div>
      </div>

      <table className="p-table info-table">
        <tbody>
          <tr>
            <td className="label">Khách hàng</td>
            <td>{sheet.customer ? `${sheet.customer.companyName} (#${sheet.customer.id})` : '-'}</td>
            <td className="label">Ngày lập</td>
            <td>{fmtDate(sheet.createdAt)}</td>
          </tr>
          <tr>
            <td className="label">Số container</td>
            <td>{sheet.containerNumber ?? '-'}</td>
            <td className="label">Container Qty</td>
            <td>{sheet.containerQuantity ?? '-'}</td>
          </tr>
          <tr>
            <td className="label">Tuyến vận chuyển</td>
            <td colSpan={3}>{sheet.fromLocation || sheet.toLocation ? `${sheet.fromLocation ?? '?'} → ${sheet.toLocation ?? '?'}` : '-'}</td>
          </tr>
          <tr>
            <td className="label">POL</td>
            <td>{sheet.pol ?? '-'}</td>
            <td className="label">POD</td>
            <td>{sheet.pod ?? '-'}</td>
          </tr>
          <tr>
            <td className="label">NW (kg)</td>
            <td>{fmtNum(sheet.nw)}</td>
            <td className="label">GW (kg)</td>
            <td>{fmtNum(sheet.gw)}</td>
          </tr>
          <tr>
            <td className="label">Ngày ETA/ETD</td>
            <td>{fmtDate(sheet.etaDate)}</td>
            <td className="label">Ngày tờ khai</td>
            <td>{fmtDate(sheet.declarationDate)}</td>
          </tr>
          <tr>
            <td className="label">Custom No</td>
            <td>{sheet.customNo ?? '-'}</td>
            <td className="label">Số bill</td>
            <td>{sheet.billNumber ?? '-'}</td>
          </tr>
          <tr>
            <td className="label">Số hóa đơn</td>
            <td>{sheet.invoiceNumber ?? '-'}</td>
            <td className="label">NV chứng từ</td>
            <td>{sheet.docStaff?.fullName ?? '-'}</td>
          </tr>
          <tr>
            <td className="label">NV giao nhận</td>
            <td colSpan={3}>{sheet.deliveryStaff?.fullName ?? '-'}</td>
          </tr>
          {sheet.note && (
            <tr>
              <td className="label">Ghi chú</td>
              <td colSpan={3}>{sheet.note}</td>
            </tr>
          )}
        </tbody>
      </table>

      {orders.length > 0 && (
        <table className="p-table">
          <thead>
            <tr>
              <th colSpan={5} className="section-title">JOB ORDER</th>
            </tr>
            <tr>
              <th>Loại</th>
              <th>Mô tả</th>
              <th className="right">Port Amt</th>
              <th>Industry</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, i) => (
              <tr key={o.id} className={groupClass(orders, i)}>
                <td>{o.type}</td>
                <td>{o.description ?? '-'}</td>
                <td className="right">{fmtMoney(o.portAmt)}</td>
                <td>{o.industry ?? '-'}</td>
                <td>{o.note ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {bookings.length > 0 && (
        <table className="p-table">
          <thead>
            <tr>
              <th colSpan={9} className="section-title">JOB BOOK TÀU</th>
            </tr>
            <tr>
              <th>Loại</th>
              <th>Mô tả</th>
              <th>Đơn vị</th>
              <th className="right">SL</th>
              <th className="right">Trước thuế</th>
              <th className="right">Thuế</th>
              <th className="right">Tiền thuế</th>
              <th className="right">Sau thuế</th>
              <th className="right">Tổng</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b, i) => (
              <tr key={b.id} className={groupClass(bookings, i)}>
                <td>{b.type}</td>
                <td>{b.description ?? '-'}</td>
                <td>{b.unit ?? '-'}</td>
                <td className="right">{b.quantity == null ? '-' : Number(b.quantity)}</td>
                <td className="right">{fmtMoney(b.pretaxAmount)}</td>
                <td className="right">{b.taxRate == null ? '-' : `${Number(b.taxRate)}%`}</td>
                <td className="right">{fmtMoney(b.taxAmount)}</td>
                <td className="right">{fmtMoney(b.afterTaxAmount)}</td>
                <td className="right">{fmtMoney(b.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {debits.length > 0 && (
        <table className="p-table">
          <thead>
            <tr>
              <th colSpan={11} className="section-title">DEBIT NOTE</th>
            </tr>
            <tr>
              <th>Loại</th>
              <th>Số hóa đơn</th>
              <th>Mô tả</th>
              <th>Unit</th>
              <th>Current</th>
              <th className="right">SL</th>
              <th className="right">Giá VND</th>
              <th className="right">Giá USD</th>
              <th className="right">Tỷ giá</th>
              <th className="right">Thuế</th>
              <th className="right">Tổng</th>
            </tr>
          </thead>
          <tbody>
            {debits.map((d, i) => (
              <tr key={d.id} className={groupClass(debits, i)}>
                <td>{d.type}</td>
                <td>{d.invoiceNumber ?? '-'}</td>
                <td>{d.description ?? '-'}</td>
                <td>{d.unit ?? '-'}</td>
                <td>{d.currency}</td>
                <td className="right">{d.quantity == null ? '-' : Number(d.quantity)}</td>
                <td className="right">{fmtMoney(d.priceVnd)}</td>
                <td className="right">{d.priceUsd == null ? '-' : Number(d.priceUsd).toLocaleString('en-US')}</td>
                <td className="right">{fmtNum(d.exchangeRate)}</td>
                <td className="right">{d.taxRate == null ? '-' : `${Number(d.taxRate)}%`}</td>
                <td className="right">{fmtMoney(d.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="signatures">
        <div className="sig">
          <div className="sig-name">Người lập phiếu</div>
        </div>
        <div className="sig">
          <div className="sig-name">NV giao nhận</div>
        </div>
        <div className="sig">
          <div className="sig-name">Khách hàng</div>
        </div>
      </div>
    </div>
  );
}

// Lấy ids từ URL, fetch batch và tự động in
function PrintContent() {
  const params = useSearchParams();
  const [sheets, setSheets] = useState<TrackingSheet[] | null>(null);
  const [error, setError] = useState('');
  const [printed, setPrinted] = useState(false);

  const orderFilter = new Set(
    (params.get('orders') ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0),
  );
  const bookingFilter = new Set(
    (params.get('bookings') ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0),
  );
  const debitFilter = new Set(
    (params.get('debits') ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0),
  );
  const selectionMode = params.has('orders') || params.has('bookings') || params.has('debits');

  useEffect(() => {
    const ids = params.get('ids') ?? '';
    const idList = ids.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
    if (!idList.length) {
      setError('Không có phiếu nào được chọn');
      setSheets([]);
      return;
    }
    apiFetch<TrackingSheet[]>(`/tracking-sheets/batch?ids=${ids}`)
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
          In phiếu
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
        (sheets ?? []).map((s) => (
          <SheetDocument
            key={s.id}
            sheet={s}
            orderFilter={orderFilter}
            bookingFilter={bookingFilter}
            debitFilter={debitFilter}
            selectionMode={selectionMode}
          />
        ))
      )}
      <style>{`
        body { background: #fff; }
        .print-sheet { margin: 0 auto; padding: 24px 32px; max-width: 860px; }
        .doc-header { text-align: center; margin-bottom: 16px; }
        .company-name { font-size: 24px; font-weight: 700; letter-spacing: 1px; }
        .company-sub { font-size: 11px; color: #666; letter-spacing: 2px; margin-top: 2px; }
        .doc-title { font-size: 18px; font-weight: 700; text-transform: uppercase; border-top: 2px solid #000; border-bottom: 2px solid #000; display: inline-block; padding: 4px 16px; margin-top: 10px; }
        .doc-no { font-size: 13px; margin-top: 6px; }
        .p-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 14px; }
        .p-table th.section-title { text-align: left; font-size: 13px; font-weight: 700; background: #fff; letter-spacing: 0.5px; }
        .p-table th, .p-table td { border: 1px solid #000; padding: 5px 8px; vertical-align: top; }
        .p-table tr.group-start td { border-top: 2px solid #000; }
        .p-table th { background: #f0f0f0; font-weight: 600; }
        .p-table .right { text-align: right; }
        .info-table td.label { background: #f5f5f5; font-weight: 600; width: 130px; }
        .signatures { display: flex; justify-content: space-between; margin-top: 48px; }
        .sig { text-align: center; width: 30%; }
        .sig-name { font-size: 13px; font-weight: 600; border-top: 1px solid #000; padding-top: 40px; }
        @media print {
          @page { margin: 12mm; }
          .no-print { display: none !important; }
          .print-sheet { max-width: 100%; padding: 0; }
          .print-sheet { page-break-after: always; break-after: page; }
          .print-sheet:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>
    </div>
  );
}

export default function PrintTrackingSheetsPage() {
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