'use client';

import { Suspense, useEffect, useState } from 'react';
import { Button, Empty, Spin, Typography } from 'antd';
import { PrinterOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface CustomerRef {
  id: number;
  customerName: string;
  companyName: string;
}

interface LiftingRow {
  id: number;
  type: string;
  description: string | null;
  portAmt?: string | null;
  total?: string | null;
  afterTaxAmount?: string | null;
  pretaxAmount?: string | null;
}

interface SheetWithLifting {
  id: number;
  sheetNumber: string;
  containerNumber: string | null;
  customer: CustomerRef | null;
  fromLocation: string | null;
  toLocation: string | null;
  etaDate: string | null;
  createdAt: string;
  jobOrders: LiftingRow[];
  jobBookings: LiftingRow[];
}

// Định dạng số tiền/số lượng theo chuẩn vi-VN
function fmtMoney(v: string | null | undefined) {
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

// Hàm LiftingDocument: xử lý LiftingDocument
function LiftingDocument({ sheet }: { sheet: SheetWithLifting }) {
  const all: (LiftingRow & { source: string })[] = [
    ...sheet.jobOrders.map((o) => ({ ...o, source: 'Job Order' })),
    ...sheet.jobBookings.map((b) => ({ ...b, source: 'Job Book tàu' })),
  ];
  const totalAll = all.reduce((sum, r) => sum + Number(r.total ?? r.portAmt ?? 0), 0);

  return (
    <div className="print-sheet">
      <div className="doc-header">
        <div className="company-name">I.H.T LOGISTICS</div>
        <div className="company-sub">ĐƠN VỊ VẬN CHUYỂN QUỐC TẾ</div>
        <div className="doc-title">PHIẾU THỐNG KÊ NÂNG HẠ</div>
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
            <td className="label">Ngày ETA/ETD</td>
            <td>{fmtDate(sheet.etaDate)}</td>
          </tr>
          <tr>
            <td className="label">Tuyến vận chuyển</td>
            <td colSpan={3}>{sheet.fromLocation || sheet.toLocation ? `${sheet.fromLocation ?? '?'} → ${sheet.toLocation ?? '?'}` : '-'}</td>
          </tr>
        </tbody>
      </table>

      {all.length > 0 && (
        <table className="p-table">
          <thead>
            <tr>
              <th colSpan={5} className="section-title">PHÍ NÂNG HẠ</th>
            </tr>
            <tr>
              <th>Nguồn</th>
              <th>Loại</th>
              <th>Mô tả</th>
              <th style={{ textAlign: 'right' }}>Số tiền</th>
              <th style={{ textAlign: 'right' }}>Tổng cộng</th>
            </tr>
          </thead>
          <tbody>
            {all.map((r) => (
              <tr key={`${r.source}-${r.id}`}>
                <td>{r.source}</td>
                <td>{r.type}</td>
                <td>{r.description ?? '-'}</td>
                <td className="right">
                  {fmtMoney(String(r.total ?? r.portAmt ?? 0))}
                </td>
                <td className="right">{fmtMoney(String(totalAll))}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td colSpan={4} className="right">TỔNG CỘNG</td>
              <td className="right">{fmtMoney(String(totalAll))}</td>
            </tr>
          </tbody>
        </table>
      )}

      <div className="signatures">
        <div className="sig">
          <div className="sig-name">Người lập phiếu</div>
        </div>
        <div className="sig">
          <div className="sig-name">Người duyệt</div>
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
  const [sheets, setSheets] = useState<SheetWithLifting[] | null>(null);
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
    apiFetch<SheetWithLifting[]>(`/reports/lifting/batch?ids=${ids}`)
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
          In Nâng hạ
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
        (sheets ?? []).filter((s) => (s.jobOrders?.length ?? 0) + (s.jobBookings?.length ?? 0) > 0).map((s) => <LiftingDocument key={s.id} sheet={s} />)
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
        .p-table tr.total-row td { border-top: 2px solid #000; font-weight: 700; background: #f5f5f5; }
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

export default function PrintLiftingNotesPage() {
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
