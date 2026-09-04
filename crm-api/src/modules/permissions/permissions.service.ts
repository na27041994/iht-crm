import { prisma } from '../../lib/prisma.js';
import { RESOURCES, REPORT_SUB_RESOURCES, TRACKING_SHEET_SUB_RESOURCES, defaultPermissionsForRole, type Resource, type Action } from './permissions.constants.js';

export type PermissionRow = {
  id: number;
  userId: number;
  resource: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

// Lấy raw rows quyền của user
export async function getUserPermissions(userId: number): Promise<PermissionRow[]> {
  return prisma.userPermission.findMany({ where: { userId }, orderBy: { resource: 'asc' } });
}

// Đảm bảo user có đủ rows quyền; backfill con từ cha nếu thiếu
export async function ensureDefaultPermissions(userId: number, role: string) {
  const rows = await prisma.userPermission.findMany({ where: { userId }, select: { resource: true } });
  const existingSet = new Set(rows.map((r) => r.resource));
  const defaults = defaultPermissionsForRole(role);
  const missing = RESOURCES.filter((r) => !existingSet.has(r));
  if (missing.length === 0) return;
  // If no rows at all, create all; if some missing (e.g. new report children), create only missing
  const data = missing.map((r) => ({
    userId,
    resource: r,
    canView: defaults[r].view,
    canCreate: defaults[r].create,
    canEdit: defaults[r].edit,
    canDelete: defaults[r].delete,
  }));
  // Backfill new report/tracking children from parent value if parent already has a row
  if (rows.length > 0) {
    const reportParent = missing.some((r) => (REPORT_SUB_RESOURCES as readonly string[]).includes(r))
      ? await prisma.userPermission.findUnique({ where: { userId_resource: { userId, resource: 'report' } } })
      : null;
    const trackingParent = missing.some((r) => (TRACKING_SHEET_SUB_RESOURCES as readonly string[]).includes(r))
      ? await prisma.userPermission.findUnique({ where: { userId_resource: { userId, resource: 'tracking_sheet' } } })
      : null;
    if (reportParent) {
      for (const d of data) if ((REPORT_SUB_RESOURCES as readonly string[]).includes(d.resource)) {
        d.canView = reportParent.canView; d.canCreate = reportParent.canCreate; d.canEdit = reportParent.canEdit; d.canDelete = reportParent.canDelete;
      }
    }
    if (trackingParent) {
      for (const d of data) if ((TRACKING_SHEET_SUB_RESOURCES as readonly string[]).includes(d.resource)) {
        d.canView = trackingParent.canView; d.canCreate = trackingParent.canCreate; d.canEdit = trackingParent.canEdit; d.canDelete = trackingParent.canDelete;
      }
    }
  }
  await prisma.userPermission.createMany({ data, skipDuplicates: true });
}

// Lưu quyền user: upsert từng resource
export async function setUserPermissions(
  userId: number,
  permissions: Array<{ resource: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>,
) {
  // validate resources
  for (const p of permissions) {
    if (!RESOURCES.includes(p.resource as Resource)) {
      throw new Error(`Resource không hợp lệ: ${p.resource}`);
    }
  }
  await prisma.$transaction(
    permissions.map((p) =>
      prisma.userPermission.upsert({
        where: { userId_resource: { userId, resource: p.resource } },
        update: { canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete },
        create: { userId, resource: p.resource, canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete },
      }),
    ),
  );
  return getUserPermissions(userId);
}

// Kiểm quyền user có đủ quyền resource+action không (admin bypass, user -> role -> fallback cha->con -> defaults)
export async function hasPermission(userId: number, resource: Resource, action: Action): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === 'admin') return true;

  const perm = await prisma.userPermission.findUnique({
    where: { userId_resource: { userId, resource } },
  });
  if (perm) {
    if (action === 'view') return perm.canView;
    if (action === 'create') return perm.canCreate;
    if (action === 'edit') return perm.canEdit;
    if (action === 'delete') return perm.canDelete;
    return false;
  }
  // Fallback theo vai trò (RolePermission)
  if (user?.role) {
    const roleRec = await prisma.role.findUnique({ where: { name: user.role } });
    if (roleRec) {
      const rp = await prisma.rolePermission.findUnique({ where: { roleId_resource: { roleId: roleRec.id, resource } } });
      if (rp) {
        if (action === 'view') return rp.canView;
        if (action === 'create') return rp.canCreate;
        if (action === 'edit') return rp.canEdit;
        if (action === 'delete') return rp.canDelete;
      }
      // parent fallback cho role
      if ((REPORT_SUB_RESOURCES as readonly string[]).includes(resource)) {
        const pr = await prisma.rolePermission.findUnique({ where: { roleId_resource: { roleId: roleRec.id, resource: 'report' } } });
        if (pr) {
          if (action === 'view') return pr.canView;
          if (action === 'create') return pr.canCreate;
          if (action === 'edit') return pr.canEdit;
          if (action === 'delete') return pr.canDelete;
        }
      }
      if ((TRACKING_SHEET_SUB_RESOURCES as readonly string[]).includes(resource)) {
        const pr = await prisma.rolePermission.findUnique({ where: { roleId_resource: { roleId: roleRec.id, resource: 'tracking_sheet' } } });
        if (pr) {
          if (action === 'view') return pr.canView;
          if (action === 'create') return pr.canCreate;
          if (action === 'edit') return pr.canEdit;
          if (action === 'delete') return pr.canDelete;
        }
      }
    }
  }
  // Fallback parent cho user
  if ((REPORT_SUB_RESOURCES as readonly string[]).includes(resource)) {
    const parent = await prisma.userPermission.findUnique({ where: { userId_resource: { userId, resource: 'report' } } });
    if (parent) {
      if (action === 'view') return parent.canView;
      if (action === 'create') return parent.canCreate;
      if (action === 'edit') return parent.canEdit;
      if (action === 'delete') return parent.canDelete;
    }
  }
  if ((TRACKING_SHEET_SUB_RESOURCES as readonly string[]).includes(resource)) {
    const parent = await prisma.userPermission.findUnique({ where: { userId_resource: { userId, resource: 'tracking_sheet' } } });
    if (parent) {
      if (action === 'view') return parent.canView;
      if (action === 'create') return parent.canCreate;
      if (action === 'edit') return parent.canEdit;
      if (action === 'delete') return parent.canDelete;
    }
  }
  const role = user?.role ?? 'viewer';
  const defaults = defaultPermissionsForRole(role);
  return defaults[resource]?.[action] ?? false;
}

// Lấy map quyền hiệu lực (user -> role -> parent -> defaults)
export async function getEffectivePermissions(userId: number): Promise<Record<Resource, Record<Action, boolean>>> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  const roleName = user?.role ?? 'viewer';
  const defaults = defaultPermissionsForRole(roleName);
  const rows = await prisma.userPermission.findMany({ where: { userId } });
  const map: Record<string, PermissionRow> = {};
  for (const r of rows) map[r.resource] = r;
  // role permissions
  let roleMap: Record<string, any> = {};
  if (roleName) {
    const roleRec = await prisma.role.findUnique({ where: { name: roleName } });
    if (roleRec) {
      const rps = await prisma.rolePermission.findMany({ where: { roleId: roleRec.id } });
      for (const rp of rps) roleMap[rp.resource] = rp;
    }
  }
  const result: Record<string, Record<Action, boolean>> = {};
  for (const res of RESOURCES) {
    const row = map[res];
    if (row) {
      result[res] = { view: row.canView, create: row.canCreate, edit: row.canEdit, delete: row.canDelete };
    } else if (roleMap[res]) {
      const rp = roleMap[res];
      result[res] = { view: rp.canView, create: rp.canCreate, edit: rp.canEdit, delete: rp.canDelete };
    } else if ((REPORT_SUB_RESOURCES as readonly string[]).includes(res) && (map['report'] || roleMap['report'])) {
      const parent = map['report'] ?? roleMap['report'];
      result[res] = { view: parent.canView, create: parent.canCreate, edit: parent.canEdit, delete: parent.canDelete };
    } else if ((TRACKING_SHEET_SUB_RESOURCES as readonly string[]).includes(res) && (map['tracking_sheet'] || roleMap['tracking_sheet'])) {
      const parent = map['tracking_sheet'] ?? roleMap['tracking_sheet'];
      result[res] = { view: parent.canView, create: parent.canCreate, edit: parent.canEdit, delete: parent.canDelete };
    } else {
      result[res] = { ...defaults[res] };
    }
  }
  return result as Record<Resource, Record<Action, boolean>>;
}
