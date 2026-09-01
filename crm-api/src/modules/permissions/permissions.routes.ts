import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/error.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, type AuthedRequest } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/auth.js';
import { RESOURCES, RESOURCE_LABELS, ACTION_LABELS } from './permissions.constants.js';
import { getUserPermissions, setUserPermissions, getEffectivePermissions, ensureDefaultPermissions } from './permissions.service.js';
import { prisma } from '../../lib/prisma.js';

export const permissionsRouter = Router();
permissionsRouter.use(requireAuth);

const setPermissionsSchema = z.object({
  permissions: z.array(
    z.object({
      resource: z.string(),
      canView: z.boolean(),
      canCreate: z.boolean(),
      canEdit: z.boolean(),
      canDelete: z.boolean(),
    }),
  ),
});

permissionsRouter.get('/resources', asyncHandler(async (_req, res) => {
  res.json({
    resources: RESOURCES.map((r) => ({ key: r, label: RESOURCE_LABELS[r] })),
    actions: [
      { key: 'view', label: ACTION_LABELS.view },
      { key: 'create', label: ACTION_LABELS.create },
      { key: 'edit', label: ACTION_LABELS.edit },
      { key: 'delete', label: ACTION_LABELS.delete },
    ],
  });
}));

permissionsRouter.get('/me', asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Chưa xác thực' });
    return;
  }
  await ensureDefaultPermissions(req.user.sub, req.user.role);
  const perms = await getEffectivePermissions(req.user.sub);
  res.json(perms);
}));

permissionsRouter.get(
  '/users/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) {
      res.status(404).json({ error: 'Không tìm thấy user' });
      return;
    }
    await ensureDefaultPermissions(userId, user.role);
    const perms = await getEffectivePermissions(userId);
    res.json(perms);
  }),
);

permissionsRouter.put(
  '/users/:id',
  requireRole('admin'),
  validate(setPermissionsSchema),
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'Không tìm thấy user' });
      return;
    }
    const { permissions } = req.body as { permissions: Array<{ resource: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }> };
    const result = await setUserPermissions(userId, permissions);
    res.json(result);
  }),
);

permissionsRouter.post(
  '/init',
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ select: { id: true, role: true } });
    for (const u of users) {
      await ensureDefaultPermissions(u.id, u.role);
    }
    res.json({ success: true, count: users.length });
  }),
);
