import { Router } from 'express';
import { asyncHandler } from '../../middleware/error.js';
import { validate, validateQuery } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { carrierSchema, listCarriersQuery } from './carrier.schema.js';
import {
  listCarriers,
  getCarrier,
  createCarrier,
  updateCarrier,
  deleteCarrier,
} from './carrier.service.js';

export const carrierRouter = Router();

carrierRouter.use(requireAuth);

carrierRouter.get(
  '/',
  validateQuery(listCarriersQuery),
  requirePermission('carrier', 'view'),
  asyncHandler(async (req, res) => {
    const { search, page, pageSize } = req.query as unknown as {
      search?: string;
      page: number;
      pageSize: number;
    };
    res.json(await listCarriers(search, page, pageSize));
  }),
);

carrierRouter.get('/:id', requirePermission('carrier', 'view'), asyncHandler(async (req, res) => {
  res.json(await getCarrier(Number(req.params.id)));
}));

carrierRouter.post(
  '/',
  validate(carrierSchema),
  requirePermission('carrier', 'create'),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createCarrier(req.body));
  }),
);

carrierRouter.put('/:id', validate(carrierSchema), requirePermission('carrier', 'edit'), asyncHandler(async (req, res) => {
  res.json(await updateCarrier(Number(req.params.id), req.body));
}));

carrierRouter.delete('/:id', requirePermission('carrier', 'delete'), asyncHandler(async (req, res) => {
  await deleteCarrier(Number(req.params.id));
  res.json({ success: true });
}));