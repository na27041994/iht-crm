'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { App, Button, Empty, Input, Popconfirm, Table, Typography } from 'antd';
import { DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, PrinterOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import dynamic from 'next/dynamic';

const TrackingSheetFormModal = dynamic(() => import('@/components/TrackingSheetFormModal'), { ssr: false });
const ExportExcelModal = dynamic(() => import('@/components/ExportExcelModal'), { ssr: false });
const ImportExcelModal = dynamic(() => import('@/components/ImportExcelModal'), { ssr: false });

interface StaffRef {
  id: number;
  fullName: string;
}

interface CustomerRef {
  id: number;
  customerName: string;
  companyName: string;
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
}

interface ListResponse {
  items: TrackingSheet[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function TrackingSheetsPage() {
  return (
    <Suspense fallback={null}>
      <TrackingSheetsContent />
    </Suspense>
  );
}

const LIST_STATE_KEY = 'tracking-sheets-list-state';

// Hàm readStoredListState: xử lý readStoredListState
function readStoredListState(): { search: string; page: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(LIST_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { search?: string; page?: number };
    const page = Math.max(1, Number(parsed.page) || 1);
    return { search: parsed.search ?? '', page };
  } catch {
    return null;
  }
}

// Hàm TrackingSheetsContent: xử lý TrackingSheetsContent
function TrackingSheetsContent() {
  const { message } = App.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlHasParams = searchParams.toString() !== '';
  const urlPage = Math.max(1, Number(searchParams.get('page')) || 1);
  const urlSearch = searchParams.get('search') ?? '';
  const stored = readStoredListState();
  const effectiveSearch = urlHasParams ? urlSearch : (stored?.search ?? '');
  const effectivePage = urlHasParams ? urlPage : (stored?.page ?? 1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(effectiveSearch);
  const [modalOpen, setModalOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const canView = usePermission('tracking_sheet', 'view');
  const canCreate = usePermission('tracking_sheet', 'create');
  const canEdit = usePermission('tracking_sheet', 'edit');
  const canDelete = usePermission('tracking_sheet', 'delete');

  const load = useCallback(
    async (kw: string, pg: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(pg) });
        if (kw) params.set('search', kw);
        const res = await apiFetch<ListResponse>(`/tracking-sheets?${params}`);
        setData(res);
        try {
          sessionStorage.setItem(LIST_STATE_KEY, JSON.stringify({ search: kw, page: pg }));
        } catch {
          // ignore
        }
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Không tải được danh sách phiếu theo dõi');
      } finally {
        setLoading(false);
      }
    },
    [message],
  );

  useEffect(() => {
    setSearchInput(effectiveSearch);
    load(effectiveSearch, effectivePage);
  }, [effectiveSearch, effectivePage, load]);

  // Hàm applyUrl: xử lý applyUrl
  function applyUrl(kw: string, pg: number) {
    try {
      sessionStorage.setItem(LIST_STATE_KEY, JSON.stringify({ search: kw, page: pg }));
    } catch {
      // ignore
    }
    const params = new URLSearchParams();
    if (kw) params.set('search', kw);
    if (pg > 1) params.set('page', String(pg));
    const qs = params.toString();
    router.push(`/tracking-sheets${qs ? `?${qs}` : ''}`);
  }

  // Hàm handleSearch: xử lý handleSearch
  function handleSearch() {
    applyUrl(searchInput.trim(), 1);
  }

  // Hàm openCreate: xử lý openCreate
  function openCreate() {
    setEditingId(null);
    setModalOpen(true);
  }

  // Hàm openPrint: xử lý openPrint
  function openPrint(ids: number[]) {
    window.open(`/print/tracking-sheets?ids=${ids.join(',')}`, '_blank', 'noopener');
  }

  // Hàm openEdit: xử lý openEdit
  function openEdit(id: number) {
    setEditingId(id);
    setModalOpen(true);
  }

  // Hàm handleDelete: xử lý handleDelete
  async function handleDelete(id: number) {
    try {
      await apiFetch(`/tracking-sheets/${id}`, { method: 'DELETE' });
      message.success('Đã xóa phiếu theo dõi');
      load(urlSearch, urlPage);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Phiếu theo dõi
          </Typography.Title>
          <Typography.Text type="secondary">Theo dõi vận chuyển theo ngày</Typography.Text>
        </div>
        <div className="flex flex-wrap gap-2">
          {canView && (
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              disabled={!selectedIds.length}
              onClick={() => openPrint(selectedIds)}
              block
              className="sm:!w-auto"
            >
              In phiếu đã chọn{selectedIds.length ? ` (${selectedIds.length})` : ''}
            </Button>
          )}
          {selectedIds.length > 0 && (
            <Button onClick={() => setSelectedIds([])} block className="sm:!w-auto">
              Bỏ chọn
            </Button>
          )}
          {canView && (
            <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)} block className="sm:!w-auto">
              Xuất Excel
            </Button>
          )}
          {canCreate && (
            <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)} block className="sm:!w-auto">
              Nhập Excel
            </Button>
          )}
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} block className="sm:!w-auto">
              Tạo phiếu theo dõi
            </Button>
          )}
        </div>
      </div>

      {!canView ? (
        <Empty description="Bạn không có quyền xem phiếu theo dõi" />
      ) : (
        <>
          <Input.Search
            placeholder="Tìm theo mã phiếu, container, khách hàng, tuyến..."
            allowClear
            enterButton={<SearchOutlined />}
            style={{ width: '100%', maxWidth: 420, marginBottom: 16 }}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={handleSearch}
          />

          <Table<TrackingSheet>
            size="small"
            rowKey="id"
            loading={loading}
            dataSource={data?.items ?? []}
            rowSelection={{
              selectedRowKeys: selectedIds,
              onChange: (keys) => setSelectedIds(keys as number[]),
              preserveSelectedRowKeys: true,
            }}
            pagination={{
              current: data?.page ?? urlPage,
              pageSize: data?.pageSize ?? 20,
              total: data?.total ?? 0,
              showSizeChanger: false,
              onChange: (p) => {
                applyUrl(urlSearch, p);
              },
            }}
            scroll={{ x: 800 }}
            columns={[
              { title: 'Mã phiếu', dataIndex: 'sheetNumber', render: (v: string, s: TrackingSheet) => <Link href={`/tracking-sheets/${s.id}`}><Typography.Text code className="cursor-pointer text-blue-600">{v}</Typography.Text></Link> },
              {
                title: 'Khách hàng',
                key: 'customer',
                render: (_: unknown, s: TrackingSheet) =>
                  s.customer ? (
                    <div className="font-medium">{s.customer.companyName}</div>
                  ) : (
                    '-'
                  ),
              },
              { title: 'Số container', dataIndex: 'containerNumber', render: (v: string | null) => v ?? '-' },
              {
                title: 'Tuyến',
                key: 'route',
                render: (_: unknown, s: TrackingSheet) =>
                  s.fromLocation || s.toLocation ? `${s.fromLocation ?? '?'} → ${s.toLocation ?? '?'}` : '-',
              },
              {
                title: 'Thao tác',
                key: 'actions',
                width: 190,
                render: (_: unknown, s: TrackingSheet) => (
                  <div className="flex gap-2">
                    <Button size="small" icon={<PrinterOutlined />} onClick={() => openPrint([s.id])}>
                      In
                    </Button>
                    {canEdit && (
                      <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(s.id)}>
                        Sửa
                      </Button>
                    )}
                    {canDelete && (
                      <Popconfirm
                        title="Xóa phiếu theo dõi?"
                        onConfirm={() => handleDelete(s.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                      >
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </>
      )}

      <TrackingSheetFormModal
        open={modalOpen}
        editingId={editingId}
        onClose={() => setModalOpen(false)}
        onSaved={() => load(urlSearch, urlPage)}
      />

      <ExportExcelModal open={exportOpen} onClose={() => setExportOpen(false)} />
      <ImportExcelModal open={importOpen} onClose={() => setImportOpen(false)} onSaved={() => load(urlSearch, urlPage)} />
    </div>
  );
}