import { Router } from 'express';
import { asyncHandler, AppError } from '../../middleware/error.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, type AuthedRequest } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { loginSchema, createUserSchema, updateUserSchema } from './auth.schema.js';
import {
  login,
  createUser,
  listUsers,
  getUser,
  updateUser,
  deactivateUser,
} from './auth.service.js';

export const authRouter = Router();

authRouter.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
  const result = await login(req.body);
  res.json(result);
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  res.json(req.user);
}));

authRouter.post(
  '/users',
  requireAuth,
  requirePermission('user', 'create'),
  validate(createUserSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createUser(req.body));
  }),
);

authRouter.get('/users', requireAuth, requirePermission('user', 'view'), asyncHandler(async (_req, res) => {
  res.json(await listUsers());
}));

authRouter.get('/users/:id', requireAuth, requirePermission('user', 'view'), asyncHandler(async (req, res) => {
  res.json(await getUser(Number(req.params.id)));
}));

authRouter.patch(
  '/users/:id',
  requireAuth,
  requirePermission('user', 'edit'),
  validate(updateUserSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await updateUser(Number(req.params.id), req.body, req.user!.sub));
  }),
);

authRouter.delete('/users/:id', requireAuth, requirePermission('user', 'delete'), asyncHandler(async (req: AuthedRequest, res) => {
  await deactivateUser(Number(req.params.id), req.user!.sub);
  res.json({ success: true });
}));

authRouter.post('/logout', requireAuth, (_req, res) => {
  res.json({ success: true });
});
