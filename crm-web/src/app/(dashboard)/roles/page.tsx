'use client';

import { useCallback, useEffect, useState } from 'react';
import { App, Button, Form, Input, Modal, Space, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { apiFetch } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermission';

interface Role {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
}

export default function RolesPage() {
  const { message } = App.useApp();
  const { can } = usePermissions();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const canView = can('role', 'view');
  const canCreate = can('role', 'create');
  const canEdit = can('role', 'edit');
  const canDelete = can('role', 'delete');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Role[]>('/roles');
      setRoles(data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không tải được vai trò');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  }
  function openEdit(r: Role) {
    setEditing(r);
    form.setFieldsValue({ displayName: r.displayName, description: r.description ?? '', name: r.name });
    setModalOpen(true);
  }
  async function handleDelete(r: Role) {
    try {
      await apiFetch(`/roles/${r.id}`, { method: 'DELETE' });
      message.success('Đã xóa vai trò');
      load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  }
  async function handleSubmit(values: { name: string; displayName: string; description?: string }) {
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/roles/${editing.id}`, { method: 'PUT', body: JSON.stringify({ displayName: values.displayName, description: values.description || null }) });
        message.success('Đã cập nhật vai trò');
      } else {
        await apiFetch('/roles', { method: 'POST', body: JSON.stringify(values) });
        message.success('Đã tạo vai trò');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { title: 'Tên vai trò', dataIndex: 'name', key: 'name', render: (v: string) => <Tag color={v==='admin'?'purple':v==='viewer'?'default':'blue'}>{v}</Tag> },
    { title: 'Tên hiển thị', dataIndex: 'displayName', key: 'displayName' },
    { title: 'Mô tả', dataIndex: 'description', key: 'description', render: (v: string | null) => v ?? '-' },
    { title: 'Hệ thống', dataIndex: 'isSystem', key: 'isSystem', width: 90, render: (v: boolean) => v ? <Tag color="gold">System</Tag> : '-' },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 180,
      render: (_: unknown, r: Role) => (
        <Space>
          {canEdit && <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Sửa</Button>}
          {canDelete && !r.isSystem && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)}>Xóa</Button>
          )}
        </Space>
      ),
    },
  ];

  if (!canView) return <Typography.Text>Bạn không có quyền xem vai trò</Typography.Text>;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Vai trò</Typography.Title>
          <Typography.Text type="secondary">Quản lý vai trò</Typography.Text>
        </div>
        {canCreate && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm vai trò</Button>}
      </div>

      <Table<Role> rowKey="id" loading={loading} dataSource={roles} columns={columns} pagination={false} />

      <Modal open={modalOpen} title={editing ? 'Sửa vai trò' : 'Thêm vai trò'} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} okText={editing ? 'Lưu' : 'Tạo'} confirmLoading={saving} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
          <Form.Item label="Tên vai trò (không dấu, vd: manager)" name="name" rules={[{ required: true, message: 'Nhập tên vai trò' }]}>
            <Input disabled={!!editing} placeholder="vd: manager, accountant_custom" />
          </Form.Item>
          <Form.Item label="Tên hiển thị" name="displayName" rules={[{ required: true, message: 'Nhập tên hiển thị' }]}>
            <Input placeholder="vd: Quản lý" />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={2} placeholder="Mô tả vai trò" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
