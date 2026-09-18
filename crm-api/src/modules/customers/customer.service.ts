import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import type { CustomerInput } from './customer.schema.js';

// Mã KH = prefix loại (KH/DL) + id đệm 5 số 0, VD: KH00012, DL00123
export function buildCustomerCode(customerType: string, id: number) {
  return `${customerType}${String(id).padStart(5, '0')}`;
}

// Hàm listCustomers: xử lý listCustomers
export async function listCustomers(search?: string, page = 1, pageSize = 20, customerType?: string) {
  const where: Prisma.CustomerWhereInput = { deletedAt: null, isDelete: 1 };
  if (customerType) where.customerType = customerType;
  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
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
  const created = await prisma.customer.create({
    data: { ...input, createdById: userId },
  });
  // sinh mã sau khi có id
  const code = buildCustomerCode(created.customerType, created.id);
  return prisma.customer.update({ where: { id: created.id }, data: { code } });
}

// Hàm updateCustomer: xử lý updateCustomer
export async function updateCustomer(id: number, input: CustomerInput) {
  const exists = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
  if (!exists) throw new AppError('Không tìm thấy khách hàng', 404);
  // đổi phân loại -> sinh lại mã theo prefix mới
  const data: Prisma.CustomerUpdateInput = { ...input };
  const nextType = (input as { customerType?: string }).customerType ?? exists.customerType;
  if (nextType !== exists.customerType || !exists.code) {
    data.code = buildCustomerCode(nextType, id);
  }
  return prisma.customer.update({ where: { id }, data });
}

// Hàm deleteCustomer: xử lý deleteCustomer
export async function deleteCustomer(id: number) {
  const exists = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
  if (!exists) throw new AppError('Không tìm thấy khách hàng', 404);
  return prisma.customer.update({ where: { id }, data: { deletedAt: new Date(), isDelete: -1 } });
}
