import { prisma } from '../../lib/prisma.js';
import type { Prisma } from '@prisma/client';

// Hàm listAuditLogs: xử lý listAuditLogs
export async function listAuditLogs(opts: {
  page: number;
  pageSize: number;
  userId?: number;
  action?: string;
  entity?: string;
  from?: Date;
  to?: Date;
}) {
  const where: Prisma.AuditLogWhereInput = {};
  if (opts.userId) where.userId = opts.userId;
  if (opts.action) where.action = opts.action;
  if (opts.entity) where.entity = opts.entity;
  if (opts.from || opts.to) {
    where.createdAt = {};
    if (opts.from) where.createdAt.gte = opts.from;
    if (opts.to) where.createdAt.lte = opts.to;
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items,
    total,
    page: opts.page,
    pageSize: opts.pageSize,
    totalPages: Math.ceil(total / opts.pageSize),
  };
}