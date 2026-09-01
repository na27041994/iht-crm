import { Router } from 'express';
import { asyncHandler } from '../../middleware/error.js';
import { validate, validateQuery } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { truckerSchema, listTruckersQuery } from './trucker.schema.js';
import {
  listTruckers,
  getTrucker,
  createTrucker,
  updateTrucker,
  deleteTrucker,
} from './trucker.service.js';

export const truckerRouter = Router();

truckerRouter.use(requireAuth);

truckerRouter.get(
  '/',
  requirePermission('trucker', 'view'),
  validateQuery(listTruckersQuery),
  asyncHandler(async (req, res) => {
    const { search, page, pageSize } = req.query as unknown as {
      search?: string;
      page: number;
      pageSize: number;
    };
    res.json(await listTruckers(search, page, pageSize));
  }),
);

truckerRouter.get('/:id', requirePermission('trucker', 'view'), asyncHandler(async (req, res) => {
  res.json(await getTrucker(Number(req.params.id)));
}));

truckerRouter.post(
  '/',
  requirePermission('trucker', 'create'),
  validate(truckerSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createTrucker(req.body));
  }),
);

truckerRouter.put('/:id', requirePermission('trucker', 'edit'), validate(truckerSchema), asyncHandler(async (req, res) => {
  res.json(await updateTrucker(Number(req.params.id), req.body));
}));

truckerRouter.delete('/:id', requirePermission('trucker', 'delete'), asyncHandler(async (req, res) => {
  await deleteTrucker(Number(req.params.id));
  res.json({ success: true });
}));