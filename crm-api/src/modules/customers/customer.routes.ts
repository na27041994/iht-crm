import { Router } from 'express';
import { asyncHandler } from '../../middleware/error.js';
import { validate, validateQuery } from '../../middleware/validate.js';
import { requireAuth, type AuthedRequest } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { customerSchema, listCustomersQuery } from './customer.schema.js';
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from './customer.service.js';

export const customerRouter = Router();

customerRouter.use(requireAuth);

customerRouter.get(
  '/',
  validateQuery(listCustomersQuery),
  requirePermission('customer', 'view'),
  asyncHandler(async (req, res) => {
    const { search, page, pageSize } = req.query as unknown as {
      search?: string;
      page: number;
      pageSize: number;
    };
    res.json(await listCustomers(search, page, pageSize));
  }),
);

customerRouter.get('/:id', requirePermission('customer', 'view'), asyncHandler(async (req, res) => {
  res.json(await getCustomer(Number(req.params.id)));
}));

customerRouter.post(
  '/',
  validate(customerSchema),
  requirePermission('customer', 'create'),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.status(201).json(await createCustomer(req.body, req.user!.sub));
  }),
);

customerRouter.put('/:id', validate(customerSchema), requirePermission('customer', 'edit'), asyncHandler(async (req, res) => {
  res.json(await updateCustomer(Number(req.params.id), req.body));
}));

customerRouter.delete('/:id', requirePermission('customer', 'delete'), asyncHandler(async (req, res) => {
  await deleteCustomer(Number(req.params.id));
  res.json({ success: true });
}));
