import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { signToken } from '../../lib/jwt.js';
import { AppError } from '../../middleware/error.js';
import type { LoginInput, CreateUserInput, UpdateUserInput } from './auth.schema.js';

// Hàm login: xử lý login
export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user || user.isDelete !== 1 || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AppError('Email hoặc mật khẩu không đúng', 401);
  }
  if (!user.isActive) {
    throw new AppError('Tài khoản đã bị vô hiệu hóa', 403);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const token = signToken({ sub: user.id, email: user.email, role: user.role });
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
  };
}

// Hàm createUser: xử lý createUser
export async function createUser(input: CreateUserInput) {
  const exists = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (exists && exists.isDelete === 1) throw new AppError('Email đã tồn tại', 409);
  const roleRec = await prisma.role.findUnique({ where: { name: input.role } });
  if (!roleRec) throw new AppError(`Vai trò ${input.role} không tồn tại`, 400);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash: await bcrypt.hash(input.password, 10),
      fullName: input.fullName,
      chineseName: input.chineseName,
      cccd: input.cccd,
      phone: input.phone,
      address: input.address,
      avatarUrl: input.avatarUrl,
      role: input.role,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      chineseName: true,
      cccd: true,
      phone: true,
      address: true,
      avatarUrl: true,
      role: true,
      isActive: true,
    },
  });
  // tạo phân quyền mặc định theo role
  const { ensureDefaultPermissions } = await import('../permissions/permissions.service.js');
  await ensureDefaultPermissions(user.id, user.role);
  return user;
}

// Hàm listUsers: xử lý listUsers
export async function listUsers() {
  return prisma.user.findMany({
    where: { isDelete: 1 },
    select: {
      id: true,
      email: true,
      fullName: true,
      chineseName: true,
      cccd: true,
      phone: true,
      address: true,
      avatarUrl: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

// Hàm getUser: xử lý getUser
export async function getUser(id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      fullName: true,
      chineseName: true,
      cccd: true,
      phone: true,
      address: true,
      avatarUrl: true,
      role: true,
      isActive: true,
      isDelete: true,
      lastLoginAt: true,
      createdAt: true,
      _count: {
        select: {
          activities: true,
        },
      },
    },
  });
  if (!user || (user as any).isDelete !== 1) throw new AppError('Không tìm thấy nhân viên', 404);
  return user;
}

// Hàm updateUser: xử lý updateUser
export async function updateUser(id: number, input: UpdateUserInput, actorId: number) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || (user as any).isDelete !== 1) throw new AppError('Không tìm thấy nhân viên', 404);

  if (id === actorId && input.role !== undefined && input.role !== user.role) {
    throw new AppError('Không thể tự thay đổi vai trò của chính mình', 400);
  }
  if (id === actorId && input.isActive === false) {
    throw new AppError('Không thể tự vô hiệu hóa tài khoản của chính mình', 400);
  }

  const data: Prisma.UserUpdateInput = {};
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.chineseName !== undefined) data.chineseName = input.chineseName;
  if (input.cccd !== undefined) data.cccd = input.cccd;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.address !== undefined) data.address = input.address;
  if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl;
  if (input.role !== undefined) {
    const roleRec = await prisma.role.findUnique({ where: { name: input.role } });
    if (!roleRec) throw new AppError(`Vai trò ${input.role} không tồn tại`, 400);
    data.role = input.role;
  }
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.password !== undefined) {
    data.passwordHash = await bcrypt.hash(input.password, 10);
  }

  return prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      fullName: true,
      chineseName: true,
      cccd: true,
      phone: true,
      address: true,
      avatarUrl: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
    },
  });
}

// Hàm deactivateUser: xử lý deactivateUser (đổi trạng thái isActive - khóa/mở, không xóa)
export async function deactivateUser(id: number, actorId: number) {
  if (id === actorId) throw new AppError('Không thể tự vô hiệu hóa tài khoản của chính mình', 400);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || (user as any).isDelete !== 1) throw new AppError('Không tìm thấy nhân viên', 404);
  return prisma.user.update({
    where: { id },
    data: { isActive: false },
    select: { id: true, email: true, isActive: true },
  });
}

// Hàm deleteUser: xóa nhân viên (soft delete isDelete=-1, khác với đổi trạng thái)
export async function deleteUser(id: number, actorId: number) {
  if (id === actorId) throw new AppError('Không thể tự xóa chính mình', 400);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || (user as any).isDelete !== 1) throw new AppError('Không tìm thấy nhân viên', 404);
  if (user.role === 'admin') {
    const adminCount = await prisma.user.count({ where: { role: 'admin', isDelete: 1, isActive: true } });
    if (adminCount <= 1) throw new AppError('Không thể xóa admin cuối cùng', 400);
  }
  // soft delete: isDelete=-1, isActive=false, đổi email để tránh trùng unique
  const deletedEmail = `deleted_${id}_${user.email}`;
  return prisma.$transaction([
    prisma.userPermission.deleteMany({ where: { userId: id } }),
    prisma.user.update({
      where: { id },
      data: { isDelete: -1, isActive: false, email: deletedEmail },
      select: { id: true, email: true, isDelete: true },
    }),
  ]);
}
