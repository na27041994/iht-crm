'use client';

import { useState, useRef } from 'react';
import { App, Button, Modal, Upload, message, Progress } from 'antd';
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import { apiDownload } from '@/lib/api';

interface ImportExcelModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function ImportExcelModal({ open, onClose, onSaved }: ImportExcelModalProps) {
  const { message } = App.useApp();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // Hàm handleDownloadTemplate: xử lý handleDownloadTemplate
  const handleDownloadTemplate = async () => {
    try {
      const blob = await apiDownload('/tracking-sheets/import-template');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mau-nhap-phieu-theo-doi.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Không tải được file mẫu');
    }
  };

  // Hàm handleUpload: xử lý handleUpload
  const handleUpload = () => {
    if (!file) {
      message.warning('Chưa chọn file');
      return;
    }
    setUploading(true);
    setProgress(0);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      setUploading(false);
      setProgress(0);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.errors?.length) {
            message.error(`Import có lỗi: ${data.errors.join('; ')}`);
          } else {
            message.success(`Đã import ${data.created} phiếu, cập nhật ${data.updated} phiếu`);
            onSaved?.();
            onClose();
          }
        } catch {
          message.error('Phản hồi không hợp lệ từ server');
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          message.error(data.error || 'Import thất bại');
        } catch {
          message.error('Import thất bại');
        }
      }
      setFile(null);
    });

    xhr.addEventListener('error', () => {
      setUploading(false);
      setProgress(0);
      message.error('Lỗi kết nối đến server');
      setFile(null);
    });

    xhr.addEventListener('abort', () => {
      setUploading(false);
      setProgress(0);
      setFile(null);
    });

    xhr.open('POST', '/api/tracking-sheets/import-excel');
    xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('accessToken')}`);
    const formData = new FormData();
    formData.append('file', file!);
    xhr.send(formData);
  };

  // Hàm handleCancel: xử lý handleCancel
  const handleCancel = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setUploading(false);
    setProgress(0);
    setFile(null);
    onClose();
  };

  // Hàm handleChange: xử lý handleChange
  const handleChange = (info: { file: File }) => {
    setFile(info.file);
  };

  return (
    <Modal
      title="Nhập phiếu theo dõi từ Excel"
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={600}
      destroyOnClose
    >
      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          <p>File Excel phải có các sheet: <strong>Phieu theo doi</strong> (bắt buộc), Job Order, Job Booking, Debit Note (tùy chọn).</p>
          <p>Xem sheet <strong>Hướng dẫn</strong> trong file mẫu để biết chi tiết.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate} type="default">
            Tải file mẫu
          </Button>
          <span className="text-sm text-gray-500">(xlsx)</span>
        </div>

        <Upload
          name="file"
          accept=".xlsx,.xls"
          fileList={file ? [{ uid: '1', name: file.name, status: 'done' }] : []}
          onChange={({ file: f }) => f && setFile(f.originFileObj as File)}
          onRemove={() => setFile(null)}
          showUploadList
          maxCount={1}
        >
          <Button icon={<UploadOutlined />} disabled={uploading || !file} type="primary">
            {uploading ? `Đang import... ${progress}%` : 'Import ngay'}
          </Button>
        </Upload>

        {uploading && (
          <div className="space-y-2">
            <Progress percent={progress} strokeWidth={8} showInfo format={() => `${progress}%`} />
            <div className="text-xs text-gray-500">Đang tải lên và xử lý...</div>
          </div>
        )}

        {file && !uploading && (
          <p className="text-sm text-gray-500">Đã chọn: {file.name}</p>
        )}

        <div className="text-xs text-gray-500 pt-2 border-t">
          <strong>Lưu ý:</strong>
          <ul className="list-disc pl-4 mt-1 space-y-1">
            <li><strong>Thêm mới:</strong> để trống cột <code>sheetNumber</code>, hệ thống tự sinh mã phiếu</li>
            <li><strong>Sửa:</strong> nhập mã phiếu có sẵn vào <code>sheetNumber</code> (mã không tồn tại sẽ báo lỗi)</li>
            <li>Các cột <code>containerNumber</code>, <code>customerId</code> không bắt buộc, có thể để trống</li>
            <li><code>customerId</code>, <code>deliveryStaffId</code>, <code>createdById</code>: nếu nhập thì điền ID từ hệ thống</li>
            <li>Ngày nhập định dạng <code>YYYY-MM-DD</code> (ví dụ: <code>2026-09-15</code>)</li>
            <li>Các sheet con dùng <code>sheetId</code> là số thứ tự 1,2,3... theo dòng phiếu, <strong>hoặc mã phiếu có sẵn</strong></li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}