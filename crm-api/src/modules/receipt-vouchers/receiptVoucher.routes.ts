import { Router } from 'express';
import { asyncHandler } from '../../middleware/error.js';
import { validate, validateQuery } from '../../middleware/validate.js';
import { requireAuth, type AuthedRequest } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { receiptVoucherSchema, listReceiptVouchersQuery, batchReceiptVouchersQuery, exportReceiptVouchersQuery } from './receiptVoucher.schema.js';
import {
  listReceiptVouchers,
  getReceiptVoucher,
  getReceiptVouchersByIds,
  getReceiptVouchersForExport,
  createReceiptVoucher,
  updateReceiptVoucher,
  deleteReceiptVoucher,
} from './receiptVoucher.service.js';
import { buildReceiptVouchersWorkbook } from './receiptVoucher.export.js';

export const receiptVoucherRouter = Router();

receiptVoucherRouter.use(requireAuth);

receiptVoucherRouter.get(
  '/',
  requirePermission('receipt_voucher', 'view'),
  validateQuery(listReceiptVouchersQuery),
  asyncHandler(async (req, res) => {
    const { search, payerType, customerId, from, to, page, pageSize } = req.query as unknown as {
      search?: string;
      payerType?: string;
      customerId?: number;
      from?: Date;
      to?: Date;
      page: number;
      pageSize: number;
    };
    res.json(await listReceiptVouchers({ search, payerType, customerId, from, to, page, pageSize }));
  }),
);

receiptVoucherRouter.get(
  '/batch',
  requirePermission('receipt_voucher', 'view'),
  validateQuery(batchReceiptVouchersQuery),
  asyncHandler(async (req, res) => {
    const ids = String(req.query.ids)
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    res.json(await getReceiptVouchersByIds(ids));
  }),
);

receiptVoucherRouter.get(
  '/export',
  requirePermission('receipt_voucher', 'view'),
  validateQuery(exportReceiptVouchersQuery),
  asyncHandler(async (req, res) => {
    const { search, payerType, customerId, from, to, ids } = req.query as unknown as {
      search?: string;
      payerType?: string;
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
    const vouchers = await getReceiptVouchersForExport({ search, payerType, customerId, from, to, ids: idList });
    const buffer = await buildReceiptVouchersWorkbook(vouchers);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="phieu-thu.xlsx"');
    res.send(buffer);
  }),
);

receiptVoucherRouter.get('/:id', requirePermission('receipt_voucher', 'view'), asyncHandler(async (req, res) => {
  res.json(await getReceiptVoucher(Number(req.params.id)));
}));

receiptVoucherRouter.post(
  '/',
  requirePermission('receipt_voucher', 'create'),
  validate(receiptVoucherSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.status(201).json(await createReceiptVoucher(req.body, req.user!.sub));
  }),
);

receiptVoucherRouter.put(
  '/:id',
  requirePermission('receipt_voucher', 'edit'),
  validate(receiptVoucherSchema),
  asyncHandler(async (req, res) => {
    res.json(await updateReceiptVoucher(Number(req.params.id), req.body));
  }),
);

receiptVoucherRouter.delete('/:id', requirePermission('receipt_voucher', 'delete'), asyncHandler(async (req, res) => {
  await deleteReceiptVoucher(Number(req.params.id));
  res.json({ success: true });
}));
