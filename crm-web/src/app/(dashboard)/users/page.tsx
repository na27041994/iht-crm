'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  App,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  PlusOutlined,
  SafetyOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { apiFetch, apiUpload } from '@/lib/api';
import Avatar from '@/components/Avatar';
import { usePermissions } from '@/hooks/usePermission';
import { RESOURCES, REPORT_SUB_RESOURCES, TRACKING_SHEET_SUB_RESOURCES, MASTER_DATA_RESOURCES, RESOURCE_LABELS, ACTION_LABELS, type Resource, type Action, type PermissionMap } from '@/lib/permissions';

interface User {
  id: number;
  email: string;
  fullName: string;
  chineseName: string | null;
  cccd: string | null;
  phone: string | null;
  address: string | null;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const FALLBACK_ROLES = ['admin', 'sales', 'ops', 'accountant', 'viewer'] as const;

const ROLE_LABEL: Record<string, string> = {
  admin: 'Quản trị',
  sales: 'Kinh doanh',
  ops: 'Điều hành',
  accountant: 'Kế toán',
  viewer: 'Chỉ xem',
};

const ROLE_COLOR: Record<string, string> = {
  admin: 'purple',
  sales: 'blue',
  ops: 'orange',
  accountant: 'green',
  viewer: 'default',
};

interface EditValues {
  fullName: string;
  chineseName?: string;
  email: string;
  cccd?: string;
  phone?: string;
  address?: string;
  role: string;
  isActive: boolean;
}

export default function UsersPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [me, setMe] = useState<{ sub: number; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const [permModalOpen, setPermModalOpen] = useState(false);
  const [editingPermUser, setEditingPermUser] = useState<User | null>(null);
  const [perms, setPerms] = useState<PermissionMap>({} as PermissionMap);
  const [permSaving, setPermSaving] = useState(false);

  const { can } = usePermissions();

  const isAdmin = me?.role === 'admin';
  const canDeleteUser = can('user', 'delete');
  const [availableRoles, setAvailableRoles] = useState<Array<{ name: string; displayName: string }>>([]);

  useEffect(() => {
    apiFetch<Array<{ name: string; displayName: string }>>('/roles')
      .then((rs) => setAvailableRoles(rs.map((r) => ({ name: r.name, displayName: r.displayName }))))
      .catch(() => setAvailableRoles(FALLBACK_ROLES.map((r) => ({ name: r, displayName: ROLE_LABEL[r] ?? r }))));
  }, []);

  const load = useCallback(async () => {
    try {
      const [userList, meInfo] = await Promise.all([
        apiFetch<User[]>('/auth/users'),
        apiFetch<{ sub: number; role: string }>('/auth/me'),
      ]);
      setUsers(userList);
      setMe(meInfo);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không tải được danh sách nhân viên');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    load();
  }, [load]);

  // Hàm openCreate: xử lý openCreate
  function openCreate() {
    setEditing(null);
    setPreview('');
    form.resetFields();
    form.setFieldsValue({ role: 'viewer', isActive: true });
    setModalOpen(true);
  }

  // Hàm openEdit: xử lý openEdit
  function openEdit(user: User) {
    setEditing(user);
    setPreview(user.avatarUrl ?? '');
    form.setFieldsValue({
      fullName: user.fullName,
      chineseName: user.chineseName ?? '',
      email: user.email,
      cccd: user.cccd ?? '',
      phone: user.phone ?? '',
      address: user.address ?? '',
      role: user.role,
      isActive: user.isActive,
    });
    setModalOpen(true);
  }

  // Mở modal phân quyền và tải quyền hiện tại
  async function openPermModal(user: User) {
    setEditingPermUser(user);
    try {
      const data = await apiFetch<PermissionMap>(`/permissions/users/${user.id}`);
      setPerms(data);
      setPermModalOpen(true);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không tải được phân quyền');
    }
  }

  // Lưu phân quyền đã chỉnh vào DB
  async function savePerms() {
    if (!editingPermUser) return;
    setPermSaving(true);
    try {
      const permissions = RESOURCES.map((resource) => ({
        resource,
        canView: perms[resource]?.view ?? false,
        canCreate: perms[resource]?.create ?? false,
        canEdit: perms[resource]?.edit ?? false,
        canDelete: perms[resource]?.delete ?? false,
      }));
      await apiFetch(`/permissions/users/${editingPermUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions }),
      });
      message.success('Đã cập nhật phân quyền');
      setPermModalOpen(false);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Lưu phân quyền thất bại');
    } finally {
      setPermSaving(false);
    }
  }

  // Hàm handleSubmit: xử lý handleSubmit
  async function handleSubmit(values: EditValues & { password?: string }) {
    setSaving(true);
    try {
      if (editing) {
        const payload: Record<string, unknown> = {
          fullName: values.fullName,
          chineseName: values.chineseName || null,
          cccd: values.cccd || null,
          phone: values.phone || null,
          address: values.address || null,
          role: values.role,
          isActive: values.isActive,
          avatarUrl: form.getFieldValue('avatarUrl') || null,
        };
        if (values.password) payload.password = values.password;
        await apiFetch(`/auth/users/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        message.success('Đã cập nhật nhân viên');
      } else {
        const payload: Record<string, unknown> = {
          fullName: values.fullName,
          chineseName: values.chineseName || null,
          email: values.email,
          password: values.password,
          cccd: values.cccd || null,
          phone: values.phone || null,
          address: values.address || null,
          role: values.role,
          avatarUrl: form.getFieldValue('avatarUrl') || null,
        };
        await apiFetch('/auth/users', { method: 'POST', body: JSON.stringify(payload) });
        message.success('Đã thêm nhân viên');
      }
      setModalOpen(false);
      await load();
      router.refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  // Hàm handleRoleChange: xử lý handleRoleChange
  async function handleRoleChange(id: number, role: string) {
    try {
      await apiFetch(`/auth/users/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) });
      message.success('Đã đổi vai trò');
      await load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Đổi vai trò thất bại');
    }
  }

  // Hàm handleToggleActive: xử lý handleToggleActive
  async function handleToggleActive(user: User) {
    try {
      await apiFetch(`/auth/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      message.success(user.isActive ? 'Đã vô hiệu hóa nhân viên' : 'Đã kích hoạt nhân viên');
      await load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Cập nhật trạng thái thất bại');
    }
  }

  // Xóa nhân viên (không cho xóa chính mình)
  async function handleDeleteUser(user: User) {
    if (me?.sub === user.id) {
      message.error('Không thể xóa chính mình');
      return;
    }
    try {
      await apiFetch(`/auth/users/${user.id}`, { method: 'DELETE' });
      message.success('Đã xóa nhân viên');
      await load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  }

  // Hàm handleAvatarUpload: xử lý handleAvatarUpload
  async function handleAvatarUpload(file: File) {
    setUploading(true);
    try {
      const { url } = await apiUpload<{ url: string }>('/upload/avatar', file);
      form.setFieldValue('avatarUrl', url);
      setPreview(url);
      message.success('Đã tải ảnh lên');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Upload ảnh thất bại');
    } finally {
      setUploading(false);
    }
  }

  const columns = [
    {
      title: 'Nhân viên',
      key: 'employee',
      render: (_: unknown, u: User) => (
        <Space>
          <Avatar name={u.fullName} url={u.avatarUrl} />
          <div>
            <Typography.Text strong>
              {u.fullName}
              {me?.sub === u.id && (
                <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
                  (bạn)
                </Typography.Text>
              )}
            </Typography.Text>
            <br />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {u.email}
            </Typography.Text>
          </div>
        </Space>
      ),
    },
    { title: 'Tên tiếng hoa', dataIndex: 'chineseName', key: 'chineseName', render: (v: string | null) => v ?? '-' },
    { title: 'Số CCCD', dataIndex: 'cccd', key: 'cccd', render: (v: string | null) => v ?? '-' },
    { title: 'Điện thoại', dataIndex: 'phone', key: 'phone', render: (v: string | null) => v ?? '-' },
    { title: 'Địa chỉ', dataIndex: 'address', key: 'address', render: (v: string | null) => v ?? '-' },
    {
      title: 'Vai trò',
      key: 'role',
      width: 140,
      render: (_: unknown, u: User) =>
        me?.sub === u.id || !isAdmin ? (
          <Tag color={ROLE_COLOR[u.role]}>{ROLE_LABEL[u.role]}</Tag>
        ) : (
          <Select
            size="small"
            value={u.role}
            style={{ width: 130 }}
            onChange={(value) => handleRoleChange(u.id, value)}
            options={availableRoles.length ? availableRoles.map((r) => ({ value: r.name, label: r.displayName })) : FALLBACK_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
          />
        ),
    },
    {
      title: 'Trạng thái',
      key: 'isActive',
      render: (_: unknown, u: User) =>
        me?.sub === u.id || !isAdmin ? (
          <Tag color={u.isActive ? 'green' : 'default'}>{u.isActive ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}</Tag>
        ) : (
          <Switch checked={u.isActive} onChange={() => handleToggleActive(u)} size="small" />
        ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 260,
      render: (_: unknown, u: User) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(u)}>
            Sửa
          </Button>
          {(isAdmin || can('user', 'edit')) && (
            <Button size="small" icon={<SafetyOutlined />} onClick={() => openPermModal(u)}>
              Phân quyền
            </Button>
          )}
          {(isAdmin || canDeleteUser) && me?.sub !== u.id && (
            <Popconfirm title={`Xóa nhân viên ${u.fullName}?`} onConfirm={() => handleDeleteUser(u)} okText="Xóa" cancelText="Hủy">
              <Button size="small" danger icon={<DeleteOutlined />}>
                Xóa
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // Helpers for parent/child permissions
  // Đồng bộ checkbox: tick cha thì tick hết con
  function setGroupChildren(children: readonly string[], parent: string | null, action: Action, checked: boolean) {
    setPerms((prev) => {
      const next = { ...prev } as PermissionMap;
      for (const r of children as unknown as Resource[]) {
        next[r] = { ...(next[r] ?? { view: false, create: false, edit: false, delete: false }), [action]: checked } as Record<Action, boolean>;
      }
      if (parent) {
        next[parent as Resource] = { ...(next[parent as Resource] ?? { view: false, create: false, edit: false, delete: false }), [action]: checked } as Record<Action, boolean>;
      }
      return next;
    });
  }
  // Cập nhật một ô quyền và đồng bộ cha nếu là con
  function setSinglePerm(resource: Resource, action: Action, checked: boolean) {
    const isReportChild = (REPORT_SUB_RESOURCES as readonly string[]).includes(resource);
    const isTrackingChild = (TRACKING_SHEET_SUB_RESOURCES as readonly string[]).includes(resource);
    setPerms((prev) => {
      const next = { ...prev } as PermissionMap;
      next[resource] = { ...(next[resource] ?? { view: false, create: false, edit: false, delete: false }), [action]: checked } as Record<Action, boolean>;
      if (isReportChild) {
        // Hàm allChecked: xử lý allChecked
        const allChecked = (REPORT_SUB_RESOURCES as readonly string[]).every((r) => (r === resource ? checked : !!next[r as Resource]?.[action]));
        next['report' as Resource] = { ...(next['report' as Resource] ?? { view: false, create: false, edit: false, delete: false }), [action]: allChecked } as Record<Action, boolean>;
      }
      if (isTrackingChild) {
        // Hàm allChecked: xử lý allChecked
        const allChecked = (TRACKING_SHEET_SUB_RESOURCES as readonly string[]).every((r) => (r === resource ? checked : !!next[r as Resource]?.[action]));
        next['tracking_sheet' as Resource] = { ...(next['tracking_sheet' as Resource] ?? { view: false, create: false, edit: false, delete: false }), [action]: allChecked } as Record<Action, boolean>;
      }
      return next;
    });
  }

  // Hàm isReportChild: xử lý isReportChild
  const isReportChild = (r: string) => (REPORT_SUB_RESOURCES as readonly string[]).includes(r);
  // Hàm isTrackingChild: xử lý isTrackingChild
  const isTrackingChild = (r: string) => (TRACKING_SHEET_SUB_RESOURCES as readonly string[]).includes(r);
  // Hàm isMasterChild: xử lý isMasterChild
  const isMasterChild = (r: string) => (MASTER_DATA_RESOURCES as readonly string[]).includes(r);

  const permColumns = [
    {
      title: 'Tài nguyên',
      key: 'resource',
      dataIndex: 'resource',
      render: (resource: string) => {
        if (resource === '__master_data') {
          return <span style={{ fontWeight: 700 }}>Dữ liệu cơ bản <span style={{ fontWeight: 400, color: '#999', fontSize: 12 }}>(tất cả)</span></span>;
        }
        if (isReportChild(resource)) {
          const label = RESOURCE_LABELS[resource as Resource];
          return <span style={{ paddingLeft: 24, color: '#595959' }}>↳ {label.replace('Báo cáo - ', '')}</span>;
        }
        if (isTrackingChild(resource)) {
          const label = RESOURCE_LABELS[resource as Resource];
          return <span style={{ paddingLeft: 24, color: '#595959' }}>↳ {label.replace('Phiếu theo dõi - ', '')}</span>;
        }
        if (isMasterChild(resource)) {
          const label = RESOURCE_LABELS[resource as Resource];
          return <span style={{ paddingLeft: 24, color: '#595959' }}>↳ {label}</span>;
        }
        if (resource === 'report' || resource === 'tracking_sheet') {
          const label = RESOURCE_LABELS[resource as Resource];
          return <span style={{ fontWeight: 700 }}>{label} <span style={{ fontWeight: 400, color: '#999', fontSize: 12 }}>(tất cả)</span></span>;
        }
        return RESOURCE_LABELS[resource as Resource] ?? resource;
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
          const checkedCount = children.filter((r) => !!perms[r]?.[action]).length;
          const allChecked = checkedCount === children.length;
          const someChecked = checkedCount > 0 && checkedCount < children.length;
          return (
            <Checkbox
              checked={allChecked}
              indeterminate={someChecked}
              onChange={(e) => setGroupChildren(MASTER_DATA_RESOURCES, null, action, e.target.checked)}
            />
          );
        }
        if (resource === 'report') {
          const children = REPORT_SUB_RESOURCES as unknown as Resource[];
          const checkedCount = children.filter((r) => !!perms[r]?.[action]).length;
          const allChecked = checkedCount === children.length && children.length > 0;
          const someChecked = checkedCount > 0 && checkedCount < children.length;
          return (
            <Checkbox
              checked={allChecked || (!!perms[resource as Resource]?.[action] && checkedCount === 0)}
              indeterminate={someChecked}
              onChange={(e) => setGroupChildren(REPORT_SUB_RESOURCES, 'report', action, e.target.checked)}
            />
          );
        }
        if (resource === 'tracking_sheet') {
          const children = TRACKING_SHEET_SUB_RESOURCES as unknown as Resource[];
          const checkedCount = children.filter((r) => !!perms[r]?.[action]).length;
          const allChecked = checkedCount === children.length && children.length > 0;
          const someChecked = checkedCount > 0 && checkedCount < children.length;
          return (
            <Checkbox
              checked={allChecked || (!!perms[resource as Resource]?.[action] && checkedCount === 0)}
              indeterminate={someChecked}
              onChange={(e) => setGroupChildren(TRACKING_SHEET_SUB_RESOURCES, 'tracking_sheet', action, e.target.checked)}
            />
          );
        }
        return (
          <Checkbox
            checked={!!perms[resource as Resource]?.[action]}
            onChange={(e) => setSinglePerm(resource as Resource, action, e.target.checked)}
          />
        );
      },
    })),
  ];

  // Hàm permDataSource: xử lý permDataSource
  const permDataSource = (() => {
    const rows: { resource: string; key: string }[] = [];
    let insertedMasterHeader = false;
    for (const r of RESOURCES) {
      if (!insertedMasterHeader && (MASTER_DATA_RESOURCES as readonly string[]).includes(r)) {
        rows.push({ resource: '__master_data', key: '__master_data' });
        insertedMasterHeader = true;
      }
      rows.push({ resource: r, key: r });
    }
    return rows;
  })();

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Nhân viên
          </Typography.Title>
          <Typography.Text type="secondary">
            {isAdmin ? 'Quản lý tài khoản và phân quyền' : 'Danh sách nhân viên trong hệ thống'}
          </Typography.Text>
        </div>
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} block className="sm:!w-auto">
            Thêm nhân viên
          </Button>
        )}
      </div>

      <Table<User>
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={users}
        columns={columns}
        pagination={false}
        scroll={{ x: 900 }}
      />

      <Modal
        open={modalOpen}
        title={editing ? 'Sửa nhân viên' : 'Thêm nhân viên'}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText={editing ? 'Lưu thay đổi' : 'Tạo tài khoản'}
        confirmLoading={saving}
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
          <Form.Item
            label="Ảnh đại diện"
            name="avatarUrl"
            hidden
          >
            <Input />
          </Form.Item>
          <div className="mb-4 flex items-center gap-4">
            <Avatar name={form.getFieldValue('fullName') || '?'} url={preview} size={56} />
            <div>
              <Upload
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                showUploadList={false}
                beforeUpload={(file) => {
                  handleAvatarUpload(file as File);
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />} loading={uploading}>
                  {uploading ? 'Đang tải lên...' : 'Chọn ảnh'}
                </Button>
              </Upload>
              {preview && (
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    form.setFieldValue('avatarUrl', '');
                    setPreview('');
                  }}
                >
                  Bỏ ảnh
                </Button>
              )}
              <div style={{ fontSize: 12, color: '#999' }}>JPG/PNG/WebP, tối đa 5MB. Tự động resize 256×256 WebP.</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              label="Tên nhân viên"
              name="fullName"
              rules={[{ required: true, message: 'Vui lòng nhập tên nhân viên' }]}
            >
              <Input placeholder="Nguyễn Văn A" />
            </Form.Item>
            <Form.Item label="Tên tiếng hoa" name="chineseName">
              <Input placeholder="陈文明" />
            </Form.Item>
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: 'Vui lòng nhập email' },
                { type: 'email', message: 'Email không hợp lệ' },
              ]}
            >
              <Input disabled={!!editing} placeholder="a.nguyen@crm.com" />
            </Form.Item>
            <Form.Item
              label={editing ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu'}
              name="password"
              rules={
                editing
                  ? [{ min: 6, message: 'Tối thiểu 6 ký tự' }]
                  : [
                      { required: true, message: 'Vui lòng nhập mật khẩu' },
                      { min: 6, message: 'Tối thiểu 6 ký tự' },
                    ]
              }
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Tối thiểu 6 ký tự" />
            </Form.Item>
            <Form.Item label="Số CCCD" name="cccd">
              <Input placeholder="0791 9900 0001" />
            </Form.Item>
            <Form.Item label="Điện thoại" name="phone">
              <Input placeholder="090 123 4567" />
            </Form.Item>
          </div>

          <Form.Item label="Địa chỉ" name="address">
            <Input placeholder="Số nhà, đường, quận/huyện, tỉnh/thành" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item label="Vai trò" name="role" rules={[{ required: true }]}>
              <Select options={availableRoles.length ? availableRoles.map((r) => ({ value: r.name, label: r.displayName })) : FALLBACK_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
            </Form.Item>
            {editing && (
              <Form.Item label="Trạng thái" name="isActive" valuePropName="checked">
                <Switch checkedChildren="Hoạt động" unCheckedChildren="Vô hiệu hóa" />
              </Form.Item>
            )}
          </div>
        </Form>
      </Modal>

      <Modal
        open={permModalOpen}
        title={`Phân quyền cho ${editingPermUser?.fullName ?? ''}`}
        width={800}
        onCancel={() => setPermModalOpen(false)}
        onOk={savePerms}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={permSaving}
        destroyOnHidden
      >
        <Table
          size="small"
          rowKey="resource"
          pagination={false}
          dataSource={permDataSource}
          columns={permColumns}
        />
      </Modal>
    </div>
  );
}
