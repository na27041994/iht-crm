'use client';

import { useEffect, useState } from 'react';
import { Breadcrumb, Button, Card, Col, Descriptions, Empty, Row, Table, Tag, Typography } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import CustomerFormModal from '@/components/CustomerFormModal';

interface Contact {
  id: number;
  fullName: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
}

interface TrackingSheet {
  id: number;
  sheetNumber: string;
  fromLocation: string | null;
  toLocation: string | null;
  containerNumber: string | null;
}

interface CustomerDetail {
  id: number;
  customerType: string;
  code: string | null;
  customerName: string;
  companyName: string;
  contactPerson: string | null;
  taxCode: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  address: string | null;
  country: string | null;
  note: string | null;
  createdAt: string;
  contacts: Contact[];
  trackingSheets: TrackingSheet[];
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    params.then(({ id: pid }) => {
      const numId = Number(pid);
      setId(numId);
      apiFetch<CustomerDetail>(`/customers/${numId}`)
        .then((c) => {
          if (!cancelled) setCustomer(c);
        })
        .catch(() => {
          if (!cancelled) setCustomer(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  // Hàm reload: xử lý reload
  async function reload() {
    if (!id) return;
    try {
      const c = await apiFetch<CustomerDetail>(`/customers/${id}`);
      setCustomer(c);
    } catch {
      /* giữ dữ liệu cũ */
    }
  }

  if (loading) {
    return <Card loading style={{ minHeight: 200 }} />;
  }

  if (!customer) {
    return (
      <Card>
        <Empty description="Không tìm thấy khách hàng" />
      </Card>
    );
  }

  const info = [
    { label: 'Mã khách hàng', value: customer.code },
    { label: 'Phân loại', value: customer.customerType },
    { label: 'Tên đơn vị', value: customer.companyName },
    { label: 'Người liên hệ', value: customer.contactPerson },
    { label: 'Mã số thuế', value: customer.taxCode },
    { label: 'Điện thoại', value: customer.phone },
    { label: 'Số fax', value: customer.fax },
    { label: 'Email', value: customer.email },
    { label: 'Địa chỉ', value: customer.address },
    { label: 'Quốc gia', value: customer.country },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Breadcrumb
            style={{ marginBottom: 8 }}
            items={[{ title: <Link href="/customers">Khách hàng</Link> }, { title: customer.customerName }]}
          />
          <Typography.Title level={3} style={{ margin: 0 }}>
            {customer.customerName}
          </Typography.Title>
        </div>
        <Button
          type="primary"
          icon={<EditOutlined />}
          onClick={() => setModalOpen(true)}
          block
          className="sm:!w-auto"
        >
          Sửa thông tin
        </Button>
      </div>

      <Card title="Thông tin khách hàng" style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="middle">
          {info.map((item) => (
            <Descriptions.Item key={item.label} label={item.label}>
              {item.value ?? '-'}
            </Descriptions.Item>
          ))}
        </Descriptions>
        {customer.note && (
          <Typography.Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
            <Typography.Text strong>Ghi chú: </Typography.Text>
            {customer.note}
          </Typography.Paragraph>
        )}
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card title={`Người liên hệ (${customer.contacts.length})`}>
            <Table<Contact>
              size="small"
              rowKey="id"
              dataSource={customer.contacts}
              pagination={false}
              locale={{ emptyText: 'Chưa có người liên hệ' }}
              scroll={{ x: 480 }}
              columns={[
                {
                  title: 'Họ tên',
                  dataIndex: 'fullName',
                  render: (v: string, c: Contact) => (
                    <span>
                      {v}
                      {c.isPrimary && (
                        <Tag color="blue" style={{ marginLeft: 6 }}>
                          Chính
                        </Tag>
                      )}
                    </span>
                  ),
                },
                { title: 'Chức vụ', dataIndex: 'position', render: (v: string | null) => v ?? '-' },
                { title: 'Điện thoại', dataIndex: 'phone', render: (v: string | null) => v ?? '-' },
                { title: 'Email', dataIndex: 'email', render: (v: string | null) => v ?? '-' },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={`Phiếu theo dõi (${customer.trackingSheets.length})`}>
            <Table<TrackingSheet>
              size="small"
              rowKey="id"
              dataSource={customer.trackingSheets}
              pagination={false}
              locale={{ emptyText: 'Chưa có phiếu theo dõi' }}
              scroll={{ x: 480 }}
              columns={[
                {
                  title: 'Mã phiếu',
                  dataIndex: 'sheetNumber',
                  render: (v: string, s: TrackingSheet) => (
                    <Link href={`/tracking-sheets/${s.id}`} className="font-medium text-blue-600 hover:underline">
                      <Typography.Text code>{v}</Typography.Text>
                    </Link>
                  ),
                },
                {
                  title: 'Tuyến',
                  render: (_: unknown, s: TrackingSheet) =>
                    s.fromLocation || s.toLocation ? `${s.fromLocation ?? ''} → ${s.toLocation ?? ''}` : '-',
                },
                { title: 'Số container', dataIndex: 'containerNumber', render: (v: string | null) => v ?? '-' },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <CustomerFormModal
        open={modalOpen}
        editingId={id}
        onClose={() => setModalOpen(false)}
        onSaved={reload}
      />
    </div>
  );
}