'use client';

import { useCallback, useEffect, useState } from 'react';
import { App, Button, Table, Tag, Typography, Space, Modal } from 'antd';
import { EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiFetch } from '@/lib/api';

interface ImportLog {
  id: number;
  filename: string;
  fileSize: number;
  totalRows: number;
  successRows: number;
  errorRows: number;
  status: 'pending' | 'completed' | 'failed' | 'partial';
  errorDetails?: string;
  createdAt: string;
  completedAt?: string;
  userName?: string;
  userEmail?: string;
}

interface ImportHistoryResponse {
  items: ImportLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Hàm fmtFileSize: xử lý fmtFileSize
const fmtFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const statusColor: Record<string, string> = {
  completed: 'success',
  failed: 'error',
  partial: 'warning',
  pending: 'processing',
};

const statusText: Record<string, string> = {
  completed: 'Hoàn tất',
  failed: 'Thất bại',
  partial: 'Một phần',
  pending: 'Đang xử lý',
};

export default function ImportHistoryPage() {
  const { message } = App.useApp();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [data, setData] = useState<ImportHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ImportLog | null>(null);

  const load = useCallback(async (pg: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pg), pageSize: String(pageSize) });
      const res = await apiFetch<ImportHistoryResponse>(`/tracking-sheets/import-history?${params}`);
      setData(res);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không tải được lịch sử import');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    load(page);
  }, [page, load]);

  // Hàm handleViewDetail: xử lý handleViewDetail
  const handleViewDetail = (log: ImportLog) => {
    setSelectedLog(log);
    setDetailModalOpen(true);
  };

  // Hàm handleDelete: xử lý handleDelete
  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/tracking-sheets/import-history/${id}`, { method: 'DELETE' });
      message.success('Đã xóa lịch sử');
      load(page);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  const columns = [
    {
      title: 'File',
      dataIndex: 'filename',
      key: 'filename',
      width: 220,
      render: (v: string) => <span className="truncate block max-w-[200px]" title={v}>{v}</span>,
    },
    {
      title: 'Kích thước',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 100,
      align: 'right' as const,
      render: fmtFileSize,
    },
    {
      title: 'Tổng dòng',
      dataIndex: 'totalRows',
      key: 'totalRows',
      width: 90,
      align: 'right' as const,
    },
    {
      title: 'Thành công',
      dataIndex: 'successRows',
      key: 'successRows',
      width: 90,
      align: 'right' as const,
      render: (v: number) => <span className="text-green-600">{v}</span>,
    },
    {
      title: 'Lỗi',
      dataIndex: 'errorRows',
      key: 'errorRows',
      width: 70,
      align: 'right' as const,
      render: (v: number) => (v > 0 ? <span className="text-red-600">{v}</span> : '0'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v: string) => <Tag color={statusColor[v] || 'default'}>{statusText[v] || v}</Tag>,
    },
    {
      title: 'Người import',
      dataIndex: 'userName',
      key: 'userName',
      width: 160,
      render: (v: string | undefined, r: ImportLog) =>
        v || r.userEmail ? (
          <div>
            <div>{v || r.userEmail}</div>
            {v && r.userEmail && <div className="text-xs text-gray-500">{r.userEmail}</div>}
          </div>
        ) : (
          '-'
        ),
    },
    {
      title: 'Thời gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      render: (_: unknown, r: ImportLog) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(r)}>
            Xem
          </Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)}>
            Xóa
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4">
        <Typography.Title level={3} style={{ margin: 0 }}>
          Lịch sử nhập Excel
        </Typography.Title>
        <Typography.Text type="secondary">
          Theo dõi lịch sử các lần import phiếu theo dõi từ file Excel
        </Typography.Text>
      </div>

      <Table<ImportLog>
        rowKey="id"
        loading={loading}
        dataSource={data?.items ?? []}
        pagination={{
          current: data?.page ?? 1,
          pageSize,
          total: data?.total ?? 0,
          onChange: setPage,
          showSizeChanger: false,
          showTotal: (total) => `Tổng ${total} lần import`,
        }}
        columns={columns}
        scroll={{ x: 1100 }}
        locale={{ emptyText: 'Chưa có lịch sử import nào' }}
      />

      <Modal
        title="Chi tiết import"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        width={700}
        footer={[
          <Button key="close" type="primary" onClick={() => setDetailModalOpen(false)}>
            Đóng
          </Button>,
        ]}
      >
        {selectedLog && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <strong>File:</strong> {selectedLog.filename}
              </div>
              <div>
                <strong>Kích thước:</strong> {fmtFileSize(selectedLog.fileSize)}
              </div>
              <div>
                <strong>Trạng thái:</strong>{' '}
                <Tag color={statusColor[selectedLog.status] || 'default'}>{statusText[selectedLog.status] || selectedLog.status}</Tag>
              </div>
              <div>
                <strong>Tổng dòng:</strong> {selectedLog.totalRows}
              </div>
              <div>
                <strong>Thành công:</strong> <span className="text-green-600">{selectedLog.successRows}</span>
              </div>
              <div>
                <strong>Lỗi:</strong> <span className="text-red-600">{selectedLog.errorRows}</span>
              </div>
              <div>
                <strong>Người import:</strong> {selectedLog.userName || selectedLog.userEmail || '-'}
              </div>
              <div>
                <strong>Thời gian tạo:</strong> {dayjs(selectedLog.createdAt).format('DD/MM/YYYY HH:mm:ss')}
              </div>
              <div>
                <strong>Hoàn tất lúc:</strong> {selectedLog.completedAt ? dayjs(selectedLog.completedAt).format('DD/MM/YYYY HH:mm:ss') : 'Chưa hoàn tất'}
              </div>
            </div>
            {selectedLog.errorDetails && (
              <div>
                <strong>Chi tiết lỗi:</strong>
                <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap break-all">
                  {(() => {
                    try {
                      const parsed = JSON.parse(selectedLog.errorDetails);
                      return Array.isArray(parsed) ? parsed.map((e: any) => (typeof e === 'string' ? e : JSON.stringify(e))).join('\n') : selectedLog.errorDetails;
                    } catch {
                      return selectedLog.errorDetails;
                    }
                  })()}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
