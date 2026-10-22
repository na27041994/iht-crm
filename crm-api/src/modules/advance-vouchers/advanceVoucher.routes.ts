import { Router } from 'express';
import { asyncHandler } from '../../middleware/error.js';
import { validate, validateQuery } from '../../middleware/validate.js';
import { requireAuth, requireRole, type AuthedRequest } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { advanceVoucherSchema, advanceItemSchema, advanceDecisionSchema, listAdvanceVouchersQuery, batchAdvanceVouchersQuery, exportAdvanceVouchersQuery } from './advanceVoucher.schema.js';
import {
  listAdvanceVouchers,
  getAdvanceVoucher,
  getAdvanceVouchersByIds,
  getAdvanceVouchersForExport,
  countAdvancePending,
  createAdvanceVoucher,
  updateAdvanceVoucher,
  deleteAdvanceVoucher,
  createAdvanceItem,
  updateAdvanceItem,
  deleteAdvanceItem,
  submitAdvanceVoucher,
  approveAdvanceDept,
  approveAdvanceAccountant,
  rejectAdvanceVoucher,
  payAdvanceVoucher,
  receiveAdvanceVoucher,
  resetAdvanceVoucher,
} from './advanceVoucher.service.js';
import { buildAdvanceVouchersWorkbook } from './advanceVoucher.export.js';

export const advanceVoucherRouter = Router();

advanceVoucherRouter.use(requireAuth);

advanceVoucherRouter.get(
  '/',
  requirePermission('advance_voucher', 'view'),
  validateQuery(listAdvanceVouchersQuery),
  asyncHandler(async (req, res) => {
    const { search, type, customerId, from, to, status, page, pageSize } = req.query as unknown as {
      search?: string;
      type?: string;
      customerId?: number;
      from?: Date;
      to?: Date;
      status?: string;
      page: number;
      pageSize: number;
    };
    res.json(await listAdvanceVouchers({ search, type, customerId, from, to, status, page, pageSize }));
  }),
);

advanceVoucherRouter.get(
  '/pending-count',
  requirePermission('advance_voucher', 'view'),
  asyncHandler(async (_req, res) => {
    res.json(await countAdvancePending());
  }),
);

advanceVoucherRouter.get(
  '/batch',
  requirePermission('advance_voucher', 'view'),
  validateQuery(batchAdvanceVouchersQuery),
  asyncHandler(async (req, res) => {
    const ids = String(req.query.ids)
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    res.json(await getAdvanceVouchersByIds(ids));
  }),
);

advanceVoucherRouter.get(
  '/export',
  requirePermission('advance_voucher', 'view'),
  validateQuery(exportAdvanceVouchersQuery),
  asyncHandler(async (req, res) => {
    const { search, type, customerId, from, to, ids } = req.query as unknown as {
      search?: string;
      type?: string;
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
    const vouchers = await getAdvanceVouchersForExport({ search, type, customerId, from, to, ids: idList });
    const buffer = await buildAdvanceVouchersWorkbook(vouchers);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="phieu-chi-tam-ung.xlsx"');
    res.send(buffer);
  }),
);

// ===== Duyệt phiếu chi =====
advanceVoucherRouter.post(
  '/:id/submit',
  requirePermission('advance_voucher', 'view'),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await submitAdvanceVoucher(Number(req.params.id), req.user!.sub));
  }),
);

advanceVoucherRouter.post(
  '/:id/approve-dept',
  requirePermission('advance_voucher', 'approve'),
  validate(advanceDecisionSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await approveAdvanceDept(Number(req.params.id), req.user!.sub, (req.body as any)?.note ?? null));
  }),
);

advanceVoucherRouter.post(
  '/:id/approve-accountant',
  requirePermission('advance_voucher', 'approve'),
  validate(advanceDecisionSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await approveAdvanceAccountant(Number(req.params.id), req.user!.sub, (req.body as any)?.note ?? null));
  }),
);

advanceVoucherRouter.post(
  '/:id/reject',
  requirePermission('advance_voucher', 'approve'),
  validate(advanceDecisionSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await rejectAdvanceVoucher(Number(req.params.id), req.user!.sub, (req.body as any)?.note ?? null));
  }),
);

advanceVoucherRouter.post(
  '/:id/pay',
  requirePermission('advance_voucher', 'pay'),
  validate(advanceDecisionSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await payAdvanceVoucher(Number(req.params.id), req.user!.sub, (req.body as any)?.note ?? null));
  }),
);

advanceVoucherRouter.post(
  '/:id/receive',
  requirePermission('advance_voucher', 'view'),
  validate(advanceDecisionSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await receiveAdvanceVoucher(Number(req.params.id), req.user!.sub, (req.body as any)?.note ?? null));
  }),
);

advanceVoucherRouter.post(
  '/:id/admin-reset',
  requireRole('admin'),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await resetAdvanceVoucher(Number(req.params.id), req.user!.sub));
  }),
);

advanceVoucherRouter.get('/:id', requirePermission('advance_voucher', 'view'), asyncHandler(async (req, res) => {
  res.json(await getAdvanceVoucher(Number(req.params.id)));
}));

advanceVoucherRouter.post(
  '/',
  requirePermission('advance_voucher', 'create'),
  validate(advanceVoucherSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.status(201).json(await createAdvanceVoucher(req.body, req.user!.sub));
  }),
);

advanceVoucherRouter.put(
  '/:id',
  requirePermission('advance_voucher', 'edit'),
  validate(advanceVoucherSchema),
  asyncHandler(async (req, res) => {
    res.json(await updateAdvanceVoucher(Number(req.params.id), req.body));
  }),
);

advanceVoucherRouter.delete('/:id', requirePermission('advance_voucher', 'delete'), asyncHandler(async (req, res) => {
  await deleteAdvanceVoucher(Number(req.params.id));
  res.json({ success: true });
}));

advanceVoucherRouter.post(
  '/:voucherId/items',
  requirePermission('advance_voucher', 'create'),
  validate(advanceItemSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.status(201).json(await createAdvanceItem(Number(req.params.voucherId), req.body));
  }),
);

advanceVoucherRouter.put(
  '/:voucherId/items/:id',
  requirePermission('advance_voucher', 'edit'),
  validate(advanceItemSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await updateAdvanceItem(Number(req.params.voucherId), Number(req.params.id), req.body));
  }),
);

advanceVoucherRouter.delete('/:voucherId/items/:id', requirePermission('advance_voucher', 'delete'), asyncHandler(async (req, res) => {
  await deleteAdvanceItem(Number(req.params.voucherId), Number(req.params.id));
  res.json({ success: true });
}));