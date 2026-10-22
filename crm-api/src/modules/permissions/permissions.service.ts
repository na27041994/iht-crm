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
  canApprove: boolean;
  canPay: boolean;
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
    canApprove: defaults[r].approve,
    canPay: defaults[r].pay,
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
  permissions: Array<{ resource: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; canApprove?: boolean; canPay?: boolean }>,
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
        update: { canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete, canApprove: !!p.canApprove, canPay: !!p.canPay },
        create: { userId, resource: p.resource, canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete, canApprove: !!p.canApprove, canPay: !!p.canPay },
      }),
    ),
  );
  return getUserPermissions(userId);
}

type PermissionFlags = {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canPay: boolean;
};

// Trả về null nếu không có row để còn fallback; false nếu có row nhưng không đủ quyền
function matchAction(row: PermissionFlags | null | undefined, action: Action): boolean | null {
  if (!row) return null;
  if (action === 'view') return row.canView;
  if (action === 'create') return row.canCreate;
  if (action === 'edit') return row.canEdit;
  if (action === 'delete') return row.canDelete;
  if (action === 'approve') return row.canApprove;
  if (action === 'pay') return row.canPay;
  return false;
}

// Kiểm quyền user có đủ quyền resource+action không (admin bypass, user -> role -> fallback cha->con -> defaults)
export async function hasPermission(userId: number, resource: Resource, action: Action): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === 'admin') return true;

  const perm = await prisma.userPermission.findUnique({
    where: { userId_resource: { userId, resource } },
  });
  const direct = matchAction(perm, action);
  if (direct !== null) return direct;

  // Fallback theo vai trò (RolePermission)
  if (user?.role) {
    const roleRec = await prisma.role.findUnique({ where: { name: user.role } });
    if (roleRec) {
      const rp = await prisma.rolePermission.findUnique({ where: { roleId_resource: { roleId: roleRec.id, resource } } });
      const rpMatch = matchAction(rp, action);
      if (rpMatch !== null) return rpMatch;
      // parent fallback cho role
      if ((REPORT_SUB_RESOURCES as readonly string[]).includes(resource)) {
        const pr = await prisma.rolePermission.findUnique({ where: { roleId_resource: { roleId: roleRec.id, resource: 'report' } } });
        const prMatch = matchAction(pr, action);
        if (prMatch !== null) return prMatch;
      }
      if ((TRACKING_SHEET_SUB_RESOURCES as readonly string[]).includes(resource)) {
        const pr = await prisma.rolePermission.findUnique({ where: { roleId_resource: { roleId: roleRec.id, resource: 'tracking_sheet' } } });
        const prMatch = matchAction(pr, action);
        if (prMatch !== null) return prMatch;
      }
    }
  }
  // Fallback parent cho user
  if ((REPORT_SUB_RESOURCES as readonly string[]).includes(resource)) {
    const parent = await prisma.userPermission.findUnique({ where: { userId_resource: { userId, resource: 'report' } } });
    const parentMatch = matchAction(parent, action);
    if (parentMatch !== null) return parentMatch;
  }
  if ((TRACKING_SHEET_SUB_RESOURCES as readonly string[]).includes(resource)) {
    const parent = await prisma.userPermission.findUnique({ where: { userId_resource: { userId, resource: 'tracking_sheet' } } });
    const parentMatch = matchAction(parent, action);
    if (parentMatch !== null) return parentMatch;
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
      result[res] = { view: row.canView, create: row.canCreate, edit: row.canEdit, delete: row.canDelete, approve: row.canApprove, pay: row.canPay };
    } else if (roleMap[res]) {
      const rp = roleMap[res];
      result[res] = { view: rp.canView, create: rp.canCreate, edit: rp.canEdit, delete: rp.canDelete, approve: rp.canApprove, pay: rp.canPay };
    } else if ((REPORT_SUB_RESOURCES as readonly string[]).includes(res) && (map['report'] || roleMap['report'])) {
      const parent = map['report'] ?? roleMap['report'];
      result[res] = { view: parent.canView, create: parent.canCreate, edit: parent.canEdit, delete: parent.canDelete, approve: parent.canApprove, pay: parent.canPay };
    } else if ((TRACKING_SHEET_SUB_RESOURCES as readonly string[]).includes(res) && (map['tracking_sheet'] || roleMap['tracking_sheet'])) {
      const parent = map['tracking_sheet'] ?? roleMap['tracking_sheet'];
      result[res] = { view: parent.canView, create: parent.canCreate, edit: parent.canEdit, delete: parent.canDelete, approve: parent.canApprove, pay: parent.canPay };
    } else {
      result[res] = { ...defaults[res] };
    }
  }
  return result as Record<Resource, Record<Action, boolean>>;
}
