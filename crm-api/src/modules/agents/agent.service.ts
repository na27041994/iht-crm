import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import type { AgentInput } from './agent.schema.js';

// Hàm listAgents: xử lý listAgents
export async function listAgents(search?: string, page = 1, pageSize = 20) {
  const where: Prisma.AgentWhereInput = { isDelete: 1 };
  if (search) {
    where.OR = [
      { agentName: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { contactPerson: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { fax: { contains: search, mode: 'insensitive' } },
      { taxCode: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.agent.count({ where }),
    prisma.agent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// Hàm getAgent: xử lý getAgent
export async function getAgent(id: number) {
  const agent = await prisma.agent.findFirst({ where: { id, isDelete: 1 } });
  if (!agent) throw new AppError('Không tìm thấy đại lý', 404);
  return agent;
}

// Hàm createAgent: xử lý createAgent
export async function createAgent(input: AgentInput) {
  return prisma.agent.create({ data: input });
}

// Hàm updateAgent: xử lý updateAgent
export async function updateAgent(id: number, input: AgentInput) {
  const exists = await prisma.agent.findFirst({ where: { id, isDelete: 1 } });
  if (!exists) throw new AppError('Không tìm thấy đại lý', 404);
  return prisma.agent.update({ where: { id }, data: input });
}

// Hàm deleteAgent: xử lý deleteAgent
export async function deleteAgent(id: number) {
  const exists = await prisma.agent.findFirst({ where: { id, isDelete: 1 } });
  if (!exists) throw new AppError('Không tìm thấy đại lý', 404);
  return prisma.agent.update({ where: { id }, data: { isDelete: -1 } });
}