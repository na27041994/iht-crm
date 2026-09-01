import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import type { TruckerInput } from './trucker.schema.js';

// Hàm listTruckers: xử lý listTruckers
export async function listTruckers(search?: string, page = 1, pageSize = 20) {
  const where: Prisma.TruckerWhereInput = { isDelete: 1 };
  if (search) {
    where.OR = [
      { truckerName: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { contactPerson: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { fax: { contains: search, mode: 'insensitive' } },
      { taxCode: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.trucker.count({ where }),
    prisma.trucker.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// Hàm getTrucker: xử lý getTrucker
export async function getTrucker(id: number) {
  const trucker = await prisma.trucker.findFirst({ where: { id, isDelete: 1 } });
  if (!trucker) throw new AppError('Không tìm thấy nhà xe', 404);
  return trucker;
}

// Hàm createTrucker: xử lý createTrucker
export async function createTrucker(input: TruckerInput) {
  return prisma.trucker.create({ data: input });
}

// Hàm updateTrucker: xử lý updateTrucker
export async function updateTrucker(id: number, input: TruckerInput) {
  const exists = await prisma.trucker.findFirst({ where: { id, isDelete: 1 } });
  if (!exists) throw new AppError('Không tìm thấy nhà xe', 404);
  return prisma.trucker.update({ where: { id }, data: input });
}

// Hàm deleteTrucker: xử lý deleteTrucker
export async function deleteTrucker(id: number) {
  const exists = await prisma.trucker.findFirst({ where: { id, isDelete: 1 } });
  if (!exists) throw new AppError('Không tìm thấy nhà xe', 404);
  return prisma.trucker.update({ where: { id }, data: { isDelete: -1 } });
}