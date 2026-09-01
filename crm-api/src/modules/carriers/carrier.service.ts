import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import type { CarrierInput } from './carrier.schema.js';

// Hàm listCarriers: xử lý listCarriers
export async function listCarriers(search?: string, page = 1, pageSize = 20) {
  const where: Prisma.CarrierWhereInput = { isDelete: 1 };
  if (search) {
    where.OR = [
      { carrierName: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { contactPerson: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { fax: { contains: search, mode: 'insensitive' } },
      { taxCode: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.carrier.count({ where }),
    prisma.carrier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// Hàm getCarrier: xử lý getCarrier
export async function getCarrier(id: number) {
  const carrier = await prisma.carrier.findFirst({ where: { id, isDelete: 1 } });
  if (!carrier) throw new AppError('Không tìm thấy hãng tàu', 404);
  return carrier;
}

// Hàm createCarrier: xử lý createCarrier
export async function createCarrier(input: CarrierInput) {
  return prisma.carrier.create({ data: input });
}

// Hàm updateCarrier: xử lý updateCarrier
export async function updateCarrier(id: number, input: CarrierInput) {
  const exists = await prisma.carrier.findFirst({ where: { id, isDelete: 1 } });
  if (!exists) throw new AppError('Không tìm thấy hãng tàu', 404);
  return prisma.carrier.update({ where: { id }, data: input });
}

// Hàm deleteCarrier: xử lý deleteCarrier
export async function deleteCarrier(id: number) {
  const exists = await prisma.carrier.findFirst({ where: { id, isDelete: 1 } });
  if (!exists) throw new AppError('Không tìm thấy hãng tàu', 404);
  return prisma.carrier.update({ where: { id }, data: { isDelete: -1 } });
}