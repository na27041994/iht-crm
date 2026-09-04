'use client';

import { useCallback, useEffect, useState } from 'react';
import { App, Button, Checkbox, Form, Input, Modal, Space, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, SafetyOutlined } from '@ant-design/icons';
import { apiFetch } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermission';
import { RESOURCES, REPORT_SUB_RESOURCES, TRACKING_SHEET_SUB_RESOURCES, MASTER_DATA_RESOURCES, RESOURCE_LABELS, ACTION_LABELS, type Resource, type Action, type PermissionMap } from '@/lib/permissions';

interface Role {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
  permissions?: Array<{ resource: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>;
}

export default function RolesPage() {
  const { message } = App.useApp();
  const { can } = usePermissions();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [permModalOpen, setPermModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [perms, setPerms] = useState<PermissionMap>({} as PermissionMap);
  const [saving, setSaving] = useState(false);
  const [permSaving, setPermSaving] = useState(false);
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

  async function openPermModal(role: Role) {
    setEditingRole(role);
    try {
      const data = await apiFetch<Array<{ resource: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>>(`/roles/${role.id}/permissions`);
      const map = {} as PermissionMap;
      for (const p of data) {
        (map as any)[p.resource] = { view: p.canView, create: p.canCreate, edit: p.canEdit, delete: p.canDelete };
      }
      // fill missing with false
      for (const r of RESOURCES) if (!(map as any)[r]) (map as any)[r] = { view: false, create: false, edit: false, delete: false };
      setPerms(map);
      setPermModalOpen(true);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không tải được phân quyền');
    }
  }
  async function savePerms() {
    if (!editingRole) return;
    setPermSaving(true);
    try {
      const permissions = RESOURCES.map((resource) => ({
        resource,
        canView: (perms as any)[resource]?.view ?? false,
        canCreate: (perms as any)[resource]?.create ?? false,
        canEdit: (perms as any)[resource]?.edit ?? false,
        canDelete: (perms as any)[resource]?.delete ?? false,
      }));
      await apiFetch(`/roles/${editingRole.id}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions }) });
      message.success('Đã cập nhật phân quyền vai trò');
      setPermModalOpen(false);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setPermSaving(false);
    }
  }

  function setGroupChildren(children: readonly string[], parent: string | null, action: Action, checked: boolean) {
    setPerms((prev) => {
      const next = { ...prev } as PermissionMap;
      for (const r of children as unknown as Resource[]) {
        (next as any)[r] = { ...((next as any)[r] ?? { view: false, create: false, edit: false, delete: false }), [action]: checked };
      }
      if (parent) (next as any)[parent] = { ...((next as any)[parent] ?? { view: false, create: false, edit: false, delete: false }), [action]: checked };
      return next;
    });
  }
  function setSinglePerm(resource: Resource, action: Action, checked: boolean) {
    const isReportChild = (REPORT_SUB_RESOURCES as readonly string[]).includes(resource);
    const isTrackingChild = (TRACKING_SHEET_SUB_RESOURCES as readonly string[]).includes(resource);
    setPerms((prev) => {
      const next = { ...prev } as PermissionMap;
      (next as any)[resource] = { ...((next as any)[resource] ?? { view: false, create: false, edit: false, delete: false }), [action]: checked };
      if (isReportChild) {
        const allChecked = (REPORT_SUB_RESOURCES as readonly string[]).every((r) => (r === resource ? checked : !!(next as any)[r]?.[action]));
        (next as any)['report'] = { ...((next as any)['report'] ?? { view: false, create: false, edit: false, delete: false }), [action]: allChecked };
      }
      if (isTrackingChild) {
        const allChecked = (TRACKING_SHEET_SUB_RESOURCES as readonly string[]).every((r) => (r === resource ? checked : !!(next as any)[r]?.[action]));
        (next as any)['tracking_sheet'] = { ...((next as any)['tracking_sheet'] ?? { view: false, create: false, edit: false, delete: false }), [action]: allChecked };
      }
      return next;
    });
  }
  const isReportChild = (r: string) => (REPORT_SUB_RESOURCES as readonly string[]).includes(r);
  const isTrackingChild = (r: string) => (TRACKING_SHEET_SUB_RESOURCES as readonly string[]).includes(r);
  const isMasterChild = (r: string) => (MASTER_DATA_RESOURCES as readonly string[]).includes(r);
  const permColumns = [
    {
      title: 'Tài nguyên',
      key: 'resource',
      dataIndex: 'resource',
      render: (resource: string) => {
        if (resource === '__master_data') return <span style={{ fontWeight: 700 }}>Dữ liệu cơ bản <span style={{ fontWeight: 400, color: '#999', fontSize: 12 }}>(tất cả)</span></span>;
        if (isReportChild(resource)) return <span style={{ paddingLeft: 24, color: '#595959' }}>↳ {(RESOURCE_LABELS as any)[resource].replace('Báo cáo - ', '')}</span>;
        if (isTrackingChild(resource)) return <span style={{ paddingLeft: 24, color: '#595959' }}>↳ {(RESOURCE_LABELS as any)[resource].replace('Phiếu theo dõi - ', '')}</span>;
        if (isMasterChild(resource)) return <span style={{ paddingLeft: 24, color: '#595959' }}>↳ {(RESOURCE_LABELS as any)[resource]}</span>;
        if (resource === 'report' || resource === 'tracking_sheet') return <span style={{ fontWeight: 700 }}>{(RESOURCE_LABELS as any)[resource]} <span style={{ fontWeight: 400, color: '#999', fontSize: 12 }}>(tất cả)</span></span>;
        return (RESOURCE_LABELS as any)[resource] ?? resource;
      },
    },
    ...(['view', 'create', 'edit', 'delete'] as Action[]).map((action) => ({
      title: ACTION_LABELS[action],
      key: action,
      width: 100,
      align: 'center' as const,
      render: (_: unknown, record: { resource: string }) => {
        const resource = record.resource;
        if (resource === '__master_data') {
          const children = MASTER_DATA_RESOURCES as unknown as Resource[];
          const checkedCount = children.filter((r) => !!(perms as any)[r]?.[action]).length;
          const allChecked = checkedCount === children.length;
          const someChecked = checkedCount > 0 && checkedCount < children.length;
          return <Checkbox checked={allChecked} indeterminate={someChecked} onChange={(e) => setGroupChildren(MASTER_DATA_RESOURCES, null, action, e.target.checked)} />;
        }
        if (resource === 'report') {
          const children = REPORT_SUB_RESOURCES as unknown as Resource[];
          const checkedCount = children.filter((r) => !!(perms as any)[r]?.[action]).length;
          const allChecked = checkedCount === children.length;
          const someChecked = checkedCount > 0 && checkedCount < children.length;
          return <Checkbox checked={allChecked || (!!(perms as any)[resource]?.[action] && checkedCount === 0)} indeterminate={someChecked} onChange={(e) => setGroupChildren(REPORT_SUB_RESOURCES, 'report', action, e.target.checked)} />;
        }
        if (resource === 'tracking_sheet') {
          const children = TRACKING_SHEET_SUB_RESOURCES as unknown as Resource[];
          const checkedCount = children.filter((r) => !!(perms as any)[r]?.[action]).length;
          const allChecked = checkedCount === children.length;
          const someChecked = checkedCount > 0 && checkedCount < children.length;
          return <Checkbox checked={allChecked || (!!(perms as any)[resource]?.[action] && checkedCount === 0)} indeterminate={someChecked} onChange={(e) => setGroupChildren(TRACKING_SHEET_SUB_RESOURCES, 'tracking_sheet', action, e.target.checked)} />;
        }
        return <Checkbox checked={!!(perms as any)[resource]?.[action]} onChange={(e) => setSinglePerm(resource as Resource, action, e.target.checked)} />;
      },
    })),
  ];
  const permDataSource = (() => {
    const rows: { resource: string; key: string }[] = [];
    let inserted = false;
    for (const r of RESOURCES) {
      if (!inserted && (MASTER_DATA_RESOURCES as readonly string[]).includes(r)) {
        rows.push({ resource: '__master_data', key: '__master_data' });
        inserted = true;
      }
      rows.push({ resource: r, key: r });
    }
    return rows;
  })();

  const columns = [
    { title: 'Tên vai trò', dataIndex: 'name', key: 'name', render: (v: string) => <Tag color={v==='admin'?'purple':v==='viewer'?'default':'blue'}>{v}</Tag> },
    { title: 'Tên hiển thị', dataIndex: 'displayName', key: 'displayName' },
    { title: 'Mô tả', dataIndex: 'description', key: 'description', render: (v: string | null) => v ?? '-' },
    { title: 'Hệ thống', dataIndex: 'isSystem', key: 'isSystem', width: 90, render: (v: boolean) => v ? <Tag color="gold">System</Tag> : '-' },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 260,
      render: (_: unknown, r: Role) => (
        <Space>
          {canEdit && <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Sửa</Button>}
          {canEdit && <Button size="small" icon={<SafetyOutlined />} onClick={() => openPermModal(r)}>Phân quyền</Button>}
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
          <Typography.Text type="secondary">Quản lý vai trò và phân quyền chi tiết</Typography.Text>
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

      <Modal open={permModalOpen} title={`Phân quyền cho ${editingRole?.displayName ?? ''}`} width={800} onCancel={() => setPermModalOpen(false)} onOk={savePerms} okText="Lưu" cancelText="Hủy" confirmLoading={permSaving} destroyOnHidden>
        <Table size="small" rowKey="resource" pagination={false} dataSource={permDataSource} columns={permColumns} />
      </Modal>
    </div>
  );
}
