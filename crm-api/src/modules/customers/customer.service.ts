import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import type { CustomerInput } from './customer.schema.js';

// Hàm listCustomers: xử lý listCustomers
export async function listCustomers(search?: string, page = 1, pageSize = 20) {
  const where: Prisma.CustomerWhereInput = { deletedAt: null, isDelete: 1 };
  if (search) {
    where.OR = [
      { customerName: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { contactPerson: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { fax: { contains: search, mode: 'insensitive' } },
      { taxCode: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        contacts: { select: { id: true, fullName: true, isPrimary: true } },
        _count: { select: { orders: true, trackingSheets: true } },
      },
    }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// Hàm getCustomer: xử lý getCustomer
export async function getCustomer(id: number) {
  const customer = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
    include: {
      contacts: { orderBy: { isPrimary: 'desc' } },
        trackingSheets: { where: { isDelete: 1 }, orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!customer) throw new AppError('Không tìm thấy khách hàng', 404);
  return customer;
}

// Hàm createCustomer: xử lý createCustomer
export async function createCustomer(input: CustomerInput, userId: number) {
  return prisma.customer.create({
    data: { ...input, createdById: userId },
  });
}

// Hàm updateCustomer: xử lý updateCustomer
export async function updateCustomer(id: number, input: CustomerInput) {
  const exists = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
  if (!exists) throw new AppError('Không tìm thấy khách hàng', 404);
  return prisma.customer.update({ where: { id }, data: input });
}

// Hàm deleteCustomer: xử lý deleteCustomer
export async function deleteCustomer(id: number) {
  const exists = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
  if (!exists) throw new AppError('Không tìm thấy khách hàng', 404);
  return prisma.customer.update({ where: { id }, data: { deletedAt: new Date(), isDelete: -1 } });
}
