import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/error.js';
import { validateQuery } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import {
  getDashboardStats,
  getRefundReport,
  getRefundItems,
  getSheetCreationReport,
  getSheetCreationItems,
  getLiftingReport,
  getLiftingItems,
  getDebitReport,
  getDebitItems,
  getProfitReport,
} from './report.service.js';
import { buildRefundReportWorkbook } from './refundReport.export.js';
import { buildSheetCreationWorkbook } from './sheetCreation.export.js';
import { buildLiftingReportWorkbook } from './liftingReport.export.js';
import { buildDebitReportWorkbook } from './debitReport.export.js';
import { buildProfitWorkbook } from './profitReport.export.js';

export const reportRouter = Router();

reportRouter.use(requireAuth);

const refundReportQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  type: z.string().optional(),
});

const refundItemsQuery = z.object({
  dim: z.enum(['customer', 'type']),
  id: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  type: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

const sheetItemsQuery = z.object({
  userId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

// Hàm parseRefundRange: xử lý parseRefundRange
function parseRefundRange(req: { query: { from?: string; to?: string } }) {
  const { from, to } = req.query;
  return {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  };
}

// Hàm parseIdParam: xử lý parseIdParam
function parseIdParam(v: string | undefined): number | null {
  if (v == null || v === 'none' || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

reportRouter.get('/dashboard', requirePermission('report', 'view'), asyncHandler(async (_req, res) => {
  res.json(await getDashboardStats());
}));

reportRouter.get('/refund/items', validateQuery(refundItemsQuery), requirePermission('report_refund', 'view'), asyncHandler(async (req, res) => {
  const { dim, id, type, page, pageSize } = req.query as unknown as {
    dim: 'customer' | 'type';
    id?: string;
    type?: string;
    page: number;
    pageSize: number;
  };
  const { from, to } = parseRefundRange(req);
  const parsedId = dim === 'type' ? (id === 'none' || id == null ? null : id) : parseIdParam(id);
  const data = await getRefundItems({
    dim,
    id: parsedId as string | number | null,
    type,
    from,
    to,
    offset: (page - 1) * pageSize,
    limit: pageSize,
  });
  res.json(data);
}));

reportRouter.get('/refund/export', validateQuery(refundReportQuery), requirePermission('report_refund', 'view'), asyncHandler(async (req, res) => {
  const { from, to, type } = req.query as { from?: string; to?: string; type?: string };
  const fromDate = from ? new Date(from) : undefined;
  const toDate = to ? new Date(to) : undefined;
  const data = await getRefundReport(fromDate, toDate, type);
  const buf = await buildRefundReportWorkbook(data, fromDate, toDate, type);
  const parts = ['bao-cao-hoan-phi'];
  if (fromDate) parts.push(fromDate.toISOString().slice(0, 10));
  if (toDate) parts.push(toDate.toISOString().slice(0, 10));
  if (type) parts.push(type);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${parts.join('_')}.xlsx"`);
  res.send(buf);
}));

reportRouter.get('/refund', validateQuery(refundReportQuery), requirePermission('report_refund', 'view'), asyncHandler(async (req, res) => {
  const { from, to, type } = req.query as { from?: string; to?: string; type?: string };
  res.json(await getRefundReport(from ? new Date(from) : undefined, to ? new Date(to) : undefined, type));
}));

reportRouter.get('/lifting/items', validateQuery(refundItemsQuery), requirePermission('report_lifting', 'view'), asyncHandler(async (req, res) => {
  const { dim, id, page, pageSize } = req.query as unknown as {
    dim: 'customer' | 'type';
    id?: string;
    page: number;
    pageSize: number;
  };
  const { from, to } = parseRefundRange(req);
  const parsedId = dim === 'type' ? (id === 'none' || id == null ? null : id) : parseIdParam(id);
  const data = await getLiftingItems({
    dim,
    id: parsedId as string | number | null,
    from,
    to,
    offset: (page - 1) * pageSize,
    limit: pageSize,
  });
  res.json(data);
}));

const liftingExportQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  ids: z.string().optional(),
});

reportRouter.get('/lifting/export', validateQuery(liftingExportQuery), requirePermission('report_lifting', 'view'), asyncHandler(async (req, res) => {
  const { from, to, ids } = req.query as { from?: string; to?: string; ids?: string };
  if (ids) {
    const idList = ids.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
    const { prisma } = await import('../../lib/prisma.js');
    const sheets = await prisma.trackingSheet.findMany({
      where: { id: { in: idList }, isDelete: 1 },
      include: {
        customer: { select: { id: true, customerName: true, companyName: true } },
        jobOrders: { where: { isDelete: 1, OR: [{ description: { contains: 'nâng hạ', mode: 'insensitive' } }, { description: { contains: 'phí nâng', mode: 'insensitive' } }, { description: { contains: 'phí hạ', mode: 'insensitive' } }] }, orderBy: { id: 'asc' } },
        jobBookings: { where: { isDelete: 1, OR: [{ description: { contains: 'nâng hạ', mode: 'insensitive' } }, { description: { contains: 'phí nâng', mode: 'insensitive' } }, { description: { contains: 'phí hạ', mode: 'insensitive' } }] }, orderBy: { id: 'asc' } },
      },
    });
    const { buildLiftingSelectedWorkbook } = await import('./liftingReport.export.js');
    const buf = await buildLiftingSelectedWorkbook(sheets);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="nang_ha_${idList.length}_phieu.xlsx"`);
    res.send(buf);
    return;
  }
  const data = await getLiftingReport(from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  const buf = await buildLiftingReportWorkbook(data, from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  const parts = ['thong-ke-nang-ha'];
  if (from) parts.push(from);
  if (to) parts.push(to);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${parts.join('_')}.xlsx"`);
  res.send(buf);
}));

reportRouter.get('/lifting', validateQuery(refundReportQuery), requirePermission('report_lifting', 'view'), asyncHandler(async (req, res) => {
  const { from, to } = parseRefundRange(req);
  res.json(await getLiftingReport(from, to));
}));

reportRouter.get('/lifting/sheets', validateQuery(z.object({
  search: z.string().optional(),
  customerId: z.coerce.number().int().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})), requirePermission('report_lifting', 'view'), asyncHandler(async (req, res) => {
  const { search, customerId, from, to, page, pageSize } = req.query as unknown as {
    search?: string;
    customerId?: number;
    from?: Date;
    to?: Date;
    page: number;
    pageSize: number;
  };
  const { getLiftingSheets } = await import('./report.service.js');
  res.json(await getLiftingSheets({ search, customerId, from, to, page, pageSize }));
}));

reportRouter.get('/lifting/batch', validateQuery(z.object({ ids: z.string().min(1) })), requirePermission('report_lifting', 'view'), asyncHandler(async (req, res) => {
  const ids = String(req.query.ids).split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
  const { prisma } = await import('../../lib/prisma.js');
  const sheets = await prisma.trackingSheet.findMany({
    where: { id: { in: ids }, isDelete: 1 },
    include: {
      customer: { select: { id: true, customerName: true, companyName: true } },
      jobOrders: { where: { isDelete: 1, OR: [{ description: { contains: 'nâng hạ', mode: 'insensitive' } }, { description: { contains: 'phí nâng', mode: 'insensitive' } }, { description: { contains: 'phí hạ', mode: 'insensitive' } }] }, orderBy: { id: 'asc' } },
      jobBookings: { where: { isDelete: 1, OR: [{ description: { contains: 'nâng hạ', mode: 'insensitive' } }, { description: { contains: 'phí nâng', mode: 'insensitive' } }, { description: { contains: 'phí hạ', mode: 'insensitive' } }] }, orderBy: { id: 'asc' } },
    },
  });
  res.json(sheets);
}));

reportRouter.get('/sheet-creation/items', validateQuery(sheetItemsQuery), requirePermission('report_sheet_creation', 'view'), asyncHandler(async (req, res) => {
  const { userId, page, pageSize } = req.query as unknown as { userId?: string; page: number; pageSize: number };
  const { from, to } = parseRefundRange(req);
  const data = await getSheetCreationItems({
    userId: userId == null || userId === '' ? undefined : parseIdParam(userId),
    from,
    to,
    offset: (page - 1) * pageSize,
    limit: pageSize,
  });
  res.json(data);
}));

reportRouter.get('/sheet-creation/export', validateQuery(refundReportQuery), requirePermission('report_sheet_creation', 'view'), asyncHandler(async (req, res) => {
  const { from, to } = parseRefundRange(req);
  const data = await getSheetCreationReport(from, to);
  const buf = await buildSheetCreationWorkbook(data.groups, from, to);
  const parts = ['thong-ke-phieu-theo-doi'];
  if (from) parts.push(from.toISOString().slice(0, 10));
  if (to) parts.push(to.toISOString().slice(0, 10));
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${parts.join('_')}.xlsx"`);
  res.send(buf);
}));

reportRouter.get('/sheet-creation', validateQuery(refundReportQuery), requirePermission('report_sheet_creation', 'view'), asyncHandler(async (req, res) => {
  const { from, to } = parseRefundRange(req);
  res.json(await getSheetCreationReport(from, to));
}));

reportRouter.get('/debit/items', validateQuery(refundItemsQuery), requirePermission('report_debit', 'view'), asyncHandler(async (req, res) => {
  const { dim, id, page, pageSize } = req.query as unknown as {
    dim: 'customer' | 'type';
    id?: string;
    page: number;
    pageSize: number;
  };
  const { from, to } = parseRefundRange(req);
  const parsedId = dim === 'type' ? (id === 'none' || id == null ? null : id) : parseIdParam(id);
  const data = await getDebitItems({
    dim,
    id: parsedId as string | number | null,
    from,
    to,
    offset: (page - 1) * pageSize,
    limit: pageSize,
  });
  res.json(data);
}));

const debitExportQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  ids: z.string().optional(),
});

reportRouter.get('/debit/export', validateQuery(debitExportQuery), requirePermission('report_debit', 'view'), asyncHandler(async (req, res) => {
  const { from, to, ids } = req.query as { from?: string; to?: string; ids?: string };
  const fromDate = from ? new Date(from) : undefined;
  const toDate = to ? new Date(to) : undefined;
  if (ids) {
    const idList = ids.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
    const { prisma } = await import('../../lib/prisma.js');
    const sheets = await prisma.trackingSheet.findMany({
      where: { id: { in: idList }, isDelete: 1 },
      include: {
        customer: { select: { id: true, customerName: true, companyName: true } },
        debitNotes: { where: { isDelete: 1 }, orderBy: { id: 'asc' } },
      },
    });
    // build simple workbook for selected sheets
    const { buildDebitSelectedWorkbook } = await import('./debitReport.export.js');
    const buf = await buildDebitSelectedWorkbook(sheets);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="debit_${idList.length}_phieu.xlsx"`);
    res.send(buf);
    return;
  }
  const data = await getDebitReport(fromDate, toDate);
  const buf = await buildDebitReportWorkbook(data, fromDate, toDate);
  const parts = ['thong-ke-debit-note'];
  if (fromDate) parts.push(fromDate.toISOString().slice(0, 10));
  if (toDate) parts.push(toDate.toISOString().slice(0, 10));
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${parts.join('_')}.xlsx"`);
  res.send(buf);
}));

reportRouter.get('/debit', validateQuery(refundReportQuery), requirePermission('report_debit', 'view'), asyncHandler(async (req, res) => {
  const { from, to } = parseRefundRange(req);
  res.json(await getDebitReport(from ? new Date(from) : undefined, to ? new Date(to) : undefined));
}));

reportRouter.get('/debit/sheets', validateQuery(z.object({
  search: z.string().optional(),
  customerId: z.coerce.number().int().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})), requirePermission('report_debit', 'view'), asyncHandler(async (req, res) => {
  const { search, customerId, from, to, page, pageSize } = req.query as unknown as {
    search?: string;
    customerId?: number;
    from?: Date;
    to?: Date;
    page: number;
    pageSize: number;
  };
  const { getDebitSheets } = await import('./report.service.js');
  res.json(await getDebitSheets({ search, customerId, from, to, page, pageSize }));
}));

reportRouter.get('/debit/batch', validateQuery(z.object({ ids: z.string().min(1) })), requirePermission('report_debit', 'view'), asyncHandler(async (req, res) => {
  const ids = String(req.query.ids).split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
  const { prisma } = await import('../../lib/prisma.js');
  const sheets = await prisma.trackingSheet.findMany({
    where: { id: { in: ids }, isDelete: 1 },
    include: {
      customer: { select: { id: true, customerName: true, companyName: true, address: true, phone: true, fax: true, contactPerson: true } },
      docStaff: { select: { id: true, fullName: true } },
      deliveryStaff: { select: { id: true, fullName: true } },
      debitNotes: { where: { isDelete: 1 }, orderBy: { id: 'asc' } },
    },
  });
  res.json(sheets);
}));

reportRouter.get('/profit', validateQuery(refundReportQuery), requirePermission('report_profit', 'view'), asyncHandler(async (req, res) => {
  const { from, to } = parseRefundRange(req);
  res.json(await getProfitReport(from ? new Date(from) : undefined, to ? new Date(to) : undefined));
}));

reportRouter.get('/profit/export', validateQuery(refundReportQuery), requirePermission('report_profit', 'view'), asyncHandler(async (req, res) => {
  const { from, to } = parseRefundRange(req);
  const data = await getProfitReport(from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  const buf = await buildProfitWorkbook(data.items, { totalRevenue: data.totalRevenue, totalServiceFees: data.totalServiceFees, totalCuocFees: data.totalCuocFees, totalProfit: data.totalProfit }, from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  const parts = ['bao-cao-loi-nhuan'];
  if (from) parts.push(new Date(from).toISOString().slice(0, 10));
  if (to) parts.push(new Date(to).toISOString().slice(0, 10));
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${parts.join('_')}.xlsx"`);
  res.send(buf);
}));
