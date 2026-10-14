import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/error.js';
import { validate, validateQuery } from '../../middleware/validate.js';
import { requireAuth, type AuthedRequest } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { trackingSheetSchema, jobOrderSchema, jobBookingSchema, debitNoteSchema, listTrackingSheetsQuery, batchTrackingSheetsQuery, exportTrackingSheetsQuery, exportJobsQuery } from './trackingSheet.schema.js';
import {
  listTrackingSheets,
  getTrackingSheet,
  getTrackingSheetsByIds,
  getTrackingSheetsForExport,
  createTrackingSheet,
  updateTrackingSheet,
  deleteTrackingSheet,
  createJobOrder,
  updateJobOrder,
  deleteJobOrder,
  createJobBooking,
  updateJobBooking,
  deleteJobBooking,
  createDebitNote,
  updateDebitNote,
  deleteDebitNote,
} from './trackingSheet.service.js';
import { buildTrackingSheetsWorkbook, buildJobsWorkbook, buildImportTemplateWorkbook } from './trackingSheet.export.js';
import { parseImportExcel, createTrackingSheetsFromImport } from './trackingSheet.import.js';
import { prisma } from '../../lib/prisma.js';

export const trackingSheetRouter = Router();

trackingSheetRouter.use(requireAuth);

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

const importHistoryQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

trackingSheetRouter.get(
  '/import-template',
  requirePermission('tracking_sheet_import_history', 'view'),
  asyncHandler(async (_req, res) => {
    const buffer = await buildImportTemplateWorkbook();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="mau-nhap-phieu-theo-doi.xlsx"');
    res.send(buffer);
  })
);

trackingSheetRouter.post(
  '/import-excel',
  upload.single('file'),
  requirePermission('tracking_sheet_import_history', 'create'),
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'Thiếu file Excel' });
      return;
    }
    // fetch full user info for display name
    let fullName: string | undefined;
    if (req.user?.sub) {
      const u = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { fullName: true } });
      fullName = u?.fullName;
    }
    const importLog = await prisma.importLog.create({
      data: {
        userId: req.user?.sub,
        userEmail: req.user?.email,
        userName: fullName ?? req.user?.email,
        filename: req.file.originalname,
        fileSize: req.file.size,
        totalRows: 0,
        successRows: 0,
        errorRows: 0,
        status: 'pending',
      },
    });
    const data = await parseImportExcel(req.file.buffer);
    const result = await createTrackingSheetsFromImport(data, req.user?.sub ?? 1, importLog.id);
    res.json({ success: result.errors.length === 0, created: result.created, updated: result.updated, errors: result.errors, validationErrors: result.validationErrors, importLogId: importLog.id });
  })
);

trackingSheetRouter.get(
  '/import-history',
  validateQuery(importHistoryQuery),
  requirePermission('tracking_sheet_import_history', 'view'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const [items, total] = await Promise.all([
      prisma.importLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          filename: true,
          fileSize: true,
          totalRows: true,
          successRows: true,
          errorRows: true,
          status: true,
          errorDetails: true,
          createdAt: true,
          completedAt: true,
          userName: true,
          userEmail: true,
        },
      }),
      prisma.importLog.count(),
    ]);
    res.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  })
);

trackingSheetRouter.get(
  '/import-history/:id',
  requirePermission('tracking_sheet_import_history', 'view'),
  asyncHandler(async (req, res) => {
    const log = await prisma.importLog.findUnique({
      where: { id: Number(req.params.id) },
      select: {
        id: true,
        filename: true,
        fileSize: true,
        totalRows: true,
        successRows: true,
        errorRows: true,
        status: true,
        errorDetails: true,
        createdAt: true,
        completedAt: true,
        userName: true,
        userEmail: true,
      },
    });
    if (!log) {
      res.status(404).json({ error: 'Không tìm thấy lịch sử import' });
      return;
    }
    res.json(log);
  })
);

trackingSheetRouter.delete(
  '/import-history/:id',
  requirePermission('tracking_sheet_import_history', 'delete'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'ID không hợp lệ' });
      return;
    }
    await prisma.importLog.delete({ where: { id } }).catch(() => null);
    res.json({ success: true });
  })
);

trackingSheetRouter.get(
  '/',
  validateQuery(listTrackingSheetsQuery),
  requirePermission('tracking_sheet_list', 'view'),
  asyncHandler(async (req, res) => {
    const { search, from, to, page, pageSize } = req.query as unknown as {
      search?: string;
      from?: Date;
      to?: Date;
      page: number;
      pageSize: number;
    };
    res.json(await listTrackingSheets(search, page, pageSize, from, to));
  }),
);

trackingSheetRouter.get(
  '/batch',
  validateQuery(batchTrackingSheetsQuery),
  requirePermission('tracking_sheet_list', 'view'),
  asyncHandler(async (req, res) => {
    const ids = String(req.query.ids)
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    res.json(await getTrackingSheetsByIds(ids));
  }),
);

trackingSheetRouter.get(
  '/descriptions',
  validateQuery(z.object({ type: z.enum(['order', 'booking', 'debit', 'advance']), search: z.string().optional(), limit: z.coerce.number().int().min(1).max(50).default(20) })),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { type, search, limit } = req.query as unknown as { type: 'order' | 'booking' | 'debit' | 'advance'; search?: string; limit: number };
    const resource = type === 'order' ? 'job_order' : type === 'booking' ? 'job_booking' : type === 'advance' ? 'advance_voucher' : 'debit_note';
    const { hasPermission } = await import('../../modules/permissions/permissions.service.js');
    const ok = await hasPermission(req.user!.sub, resource as any, 'view');
    if (!ok) {
      res.status(403).json({ error: `Bạn không có quyền view ${resource}` });
      return;
    }
    const kw = search?.trim();
    if (type === 'order') {
      const rows = await prisma.jobOrder.groupBy({
        by: ['description'],
        where: { isDelete: 1, description: kw ? { contains: kw, mode: 'insensitive' } : { not: null } },
        orderBy: { description: 'asc' },
        take: limit,
      });
      res.json(rows.map((r) => r.description).filter(Boolean));
      return;
    }
    if (type === 'booking') {
      const rows = await prisma.jobBooking.groupBy({
        by: ['description'],
        where: { isDelete: 1, description: kw ? { contains: kw, mode: 'insensitive' } : { not: null } },
        orderBy: { description: 'asc' },
        take: limit,
      });
      res.json(rows.map((r) => r.description).filter(Boolean));
      return;
    }
    if (type === 'advance') {
      const rows = await prisma.advanceVoucherItem.groupBy({
        by: ['description'],
        where: { isDelete: 1, description: kw ? { contains: kw, mode: 'insensitive' } : { not: null } },
        orderBy: { description: 'asc' },
        take: limit,
      });
      res.json(rows.map((r) => r.description).filter(Boolean));
      return;
    }
    const rows = await prisma.debitNote.groupBy({
      by: ['description'],
      where: { isDelete: 1, description: kw ? { contains: kw, mode: 'insensitive' } : { not: null } },
      orderBy: { description: 'asc' },
      take: limit,
    });
    res.json(rows.map((r) => r.description).filter(Boolean));
  }),
);

trackingSheetRouter.get(
  '/export',
  validateQuery(exportTrackingSheetsQuery),
  requirePermission('tracking_sheet_list', 'view'),
  asyncHandler(async (req, res) => {
    const { search, customerId, from, to, ids } = req.query as unknown as {
      search?: string;
      customerId?: number;
      from?: Date;
      to?: Date;
      ids?: string;
    };
    const idList = ids
      ? ids
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isInteger(n) && n > 0)
      : undefined;
    const sheets = await getTrackingSheetsForExport({ search, customerId, from, to, ids: idList });
    const buffer = await buildTrackingSheetsWorkbook(sheets);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="phieu-theo-doi.xlsx"');
    res.send(buffer);
  }),
);

// Xuất Excel gộp các dòng cược của các phiếu đã chọn (hoặc theo filter khi không truyền ids)
trackingSheetRouter.get(
  '/deposit-export',
  requirePermission('tracking_sheet_list', 'view'),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as { ids?: string; search?: string; from?: string; to?: string };
    const ids = String(q.ids ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 200);
    const where: Record<string, unknown> = { isDelete: 1 };
    if (ids.length) {
      (where as any).id = { in: ids };
    } else {
      if (q.from || q.to) {
        (where as any).createdAt = {};
        if (q.from) (where as any).createdAt.gte = new Date(q.from);
        if (q.to) (where as any).createdAt.lte = new Date(q.to);
      }
      if (q.search) {
        const s = q.search;
        (where as any).OR = [
          { sheetNumber: { contains: s, mode: 'insensitive' } },
          { containerNumber: { contains: s, mode: 'insensitive' } },
          { customer: { is: { companyName: { contains: s, mode: 'insensitive' } } } },
          { fromLocation: { contains: s, mode: 'insensitive' } },
          { toLocation: { contains: s, mode: 'insensitive' } },
          { customNo: { contains: s, mode: 'insensitive' } },
          { billNumber: { contains: s, mode: 'insensitive' } },
          { invoiceNumber: { contains: s, mode: 'insensitive' } },
          { consignee: { contains: s, mode: 'insensitive' } },
          { shipper: { contains: s, mode: 'insensitive' } },
          { note: { contains: s, mode: 'insensitive' } },
          { pol: { contains: s, mode: 'insensitive' } },
          { pod: { contains: s, mode: 'insensitive' } },
        ];
      }
    }
    const { prisma } = await import('../../lib/prisma.js');
    const sheets = await prisma.trackingSheet.findMany({
      where: { id: { in: ids }, isDelete: 1 },
      orderBy: { id: 'asc' },
      include: {
        customer: { select: { id: true, companyName: true } },
        carrier: { select: { id: true, carrierName: true } },
        jobBookings: { where: { isDelete: 1 }, orderBy: { id: 'asc' } },
      },
    });
    const { buildDepositsWorkbook } = await import('./trackingSheet.export.js');
    const buffer = await buildDepositsWorkbook(sheets);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="cuoc-cont_${ids.length}_phieu.xlsx"`);
    res.send(buffer);
  }),
);

trackingSheetRouter.get(
  '/:id/export',
  validateQuery(exportJobsQuery),
  asyncHandler(async (req: AuthedRequest, res, next) => {
    const { type } = req.query as unknown as { type: 'order' | 'booking' | 'debit' | 'deposit' };
    const resource = type === 'order' ? 'job_order' : type === 'debit' ? 'debit_note' : 'job_booking';
    const { hasPermission } = await import('../../modules/permissions/permissions.service.js');
    const ok = await hasPermission(req.user!.sub, resource as any, 'view');
    if (!ok) {
      res.status(403).json({ error: `Bạn không có quyền view ${resource}` });
      return;
    }
    next();
  }),
  asyncHandler(async (req, res) => {
    const { type } = req.query as unknown as { type: 'order' | 'booking' | 'debit' | 'deposit' };
    const sheet = await getTrackingSheet(Number(req.params.id));
    if (!sheet) {
      res.status(404).json({ error: 'Không tìm thấy phiếu theo dõi' });
      return;
    }
    const { prisma } = await import('../../lib/prisma.js');
    const me = await prisma.user.findUnique({ where: { id: (req as unknown as AuthedRequest).user!.sub }, select: { fullName: true } });
    const buffer = await buildJobsWorkbook(sheet, type, me?.fullName ?? '');
    const prefix = type === 'order' ? 'job-order' : type === 'booking' ? 'job-book-tau' : type === 'deposit' ? 'cuoc-cont' : 'debit-note';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${prefix}-${sheet.sheetNumber}.xlsx"`);
    res.send(buffer);
  }),
);

trackingSheetRouter.get('/:id', requirePermission('tracking_sheet_list', 'view'), asyncHandler(async (req, res) => {
  res.json(await getTrackingSheet(Number(req.params.id)));
}));

trackingSheetRouter.post(
  '/',
  validate(trackingSheetSchema),
  requirePermission('tracking_sheet_list', 'create'),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.status(201).json(await createTrackingSheet(req.body, req.user?.sub));
  }),
);

trackingSheetRouter.put('/:id', validate(trackingSheetSchema), requirePermission('tracking_sheet_list', 'edit'), asyncHandler(async (req, res) => {
  res.json(await updateTrackingSheet(Number(req.params.id), req.body));
}));

trackingSheetRouter.delete('/:id', requirePermission('tracking_sheet_list', 'delete'), asyncHandler(async (req, res) => {
  await deleteTrackingSheet(Number(req.params.id));
  res.json({ success: true });
}));

trackingSheetRouter.post('/:sheetId/job-orders', validate(jobOrderSchema), requirePermission('job_order', 'create'), asyncHandler(async (req, res) => {
  res.status(201).json(await createJobOrder(Number(req.params.sheetId), req.body));
}));

trackingSheetRouter.put('/:sheetId/job-orders/:id', validate(jobOrderSchema), requirePermission('job_order', 'edit'), asyncHandler(async (req, res) => {
  res.json(await updateJobOrder(Number(req.params.sheetId), Number(req.params.id), req.body));
}));

trackingSheetRouter.delete('/:sheetId/job-orders/:id', requirePermission('job_order', 'delete'), asyncHandler(async (req, res) => {
  await deleteJobOrder(Number(req.params.sheetId), Number(req.params.id));
  res.json({ success: true });
}));

trackingSheetRouter.post('/:sheetId/job-bookings', validate(jobBookingSchema), requirePermission('job_booking', 'create'), asyncHandler(async (req, res) => {
  res.status(201).json(await createJobBooking(Number(req.params.sheetId), req.body));
}));

trackingSheetRouter.put('/:sheetId/job-bookings/:id', validate(jobBookingSchema), requirePermission('job_booking', 'edit'), asyncHandler(async (req, res) => {
  res.json(await updateJobBooking(Number(req.params.sheetId), Number(req.params.id), req.body));
}));

trackingSheetRouter.delete('/:sheetId/job-bookings/:id', requirePermission('job_booking', 'delete'), asyncHandler(async (req, res) => {
  await deleteJobBooking(Number(req.params.sheetId), Number(req.params.id));
  res.json({ success: true });
}));

trackingSheetRouter.post('/:sheetId/debit-notes', validate(debitNoteSchema), requirePermission('debit_note', 'create'), asyncHandler(async (req, res) => {
  res.status(201).json(await createDebitNote(Number(req.params.sheetId), req.body));
}));

trackingSheetRouter.put('/:sheetId/debit-notes/:id', validate(debitNoteSchema), requirePermission('debit_note', 'edit'), asyncHandler(async (req, res) => {
  res.json(await updateDebitNote(Number(req.params.sheetId), Number(req.params.id), req.body));
}));

trackingSheetRouter.delete('/:sheetId/debit-notes/:id', requirePermission('debit_note', 'delete'), asyncHandler(async (req, res) => {
  await deleteDebitNote(Number(req.params.sheetId), Number(req.params.id));
  res.json({ success: true });
}));
