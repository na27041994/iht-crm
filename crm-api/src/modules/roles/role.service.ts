import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import { RESOURCES, defaultPermissionsForRole } from '../permissions/permissions.constants.js';

export async function listRoles() {
  return prisma.role.findMany({ include: { permissions: true }, orderBy: { id: 'asc' } });
}

export async function getRole(id: number) {
  const role = await prisma.role.findUnique({ where: { id }, include: { permissions: true } });
  if (!role) throw new AppError('Không tìm thấy vai trò', 404);
  return role;
}

export async function getRoleByName(name: string) {
  return prisma.role.findUnique({ where: { name }, include: { permissions: true } });
}

export async function createRole(input: { name: string; displayName: string; description?: string | null }) {
  const exists = await prisma.role.findUnique({ where: { name: input.name } });
  if (exists) throw new AppError('Tên vai trò đã tồn tại', 409);
  const role = await prisma.role.create({ data: input });
  // tạo quyền mặc định cho role mới (none)
  const defaults = defaultPermissionsForRole('viewer');
  const perms = RESOURCES.map((r) => ({
    roleId: role.id,
    resource: r,
    canView: defaults[r as keyof typeof defaults]?.view ?? false,
    canCreate: defaults[r as keyof typeof defaults]?.create ?? false,
    canEdit: defaults[r as keyof typeof defaults]?.edit ?? false,
    canDelete: defaults[r as keyof typeof defaults]?.delete ?? false,
  }));
  await prisma.rolePermission.createMany({ data: perms });
  return prisma.role.findUnique({ where: { id: role.id }, include: { permissions: true } });
}

export async function updateRole(id: number, input: { displayName?: string; description?: string | null }) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw new AppError('Không tìm thấy vai trò', 404);
  if (role.isSystem && input.displayName && input.displayName !== role.displayName) {
    // cho phép đổi displayName của system role nhưng không đổi name
  }
  return prisma.role.update({ where: { id }, data: input, include: { permissions: true } });
}

export async function deleteRole(id: number) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw new AppError('Không tìm thấy vai trò', 404);
  if (role.isSystem) throw new AppError('Không thể xóa vai trò hệ thống', 400);
  const usersWithRole = await prisma.user.count({ where: { role: role.name as any } });
  if (usersWithRole > 0) throw new AppError(`Còn ${usersWithRole} nhân viên đang dùng vai trò này`, 400);
  await prisma.role.delete({ where: { id } });
  return { success: true };
}

export async function getRolePermissions(roleId: number) {
  const role = await prisma.role.findUnique({ where: { id: roleId }, include: { permissions: true } });
  if (!role) throw new AppError('Không tìm thấy vai trò', 404);
  return role.permissions;
}

export async function setRolePermissions(roleId: number, permissions: Array<{ resource: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new AppError('Không tìm thấy vai trò', 404);
  for (const p of permissions) {
    if (!RESOURCES.includes(p.resource as any)) throw new AppError(`Resource không hợp lệ: ${p.resource}`, 400);
  }
  await prisma.$transaction(
    permissions.map((p) =>
      prisma.rolePermission.upsert({
        where: { roleId_resource: { roleId, resource: p.resource } },
        update: { canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete },
        create: { roleId, resource: p.resource, canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete },
      }),
    ),
  );
  return prisma.rolePermission.findMany({ where: { roleId } });
}
