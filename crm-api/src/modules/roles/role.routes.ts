import { Router } from 'express';
import { asyncHandler } from '../../middleware/error.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { createRoleSchema, updateRoleSchema, rolePermissionSchema } from './role.schema.js';
import * as roleService from './role.service.js';
import { z } from 'zod';

export const roleRouter = Router();
roleRouter.use(requireAuth);

roleRouter.get('/', requirePermission('role', 'view'), asyncHandler(async (_req, res) => {
  res.json(await roleService.listRoles());
}));

roleRouter.get('/:id', requirePermission('role', 'view'), asyncHandler(async (req, res) => {
  res.json(await roleService.getRole(Number(req.params.id)));
}));

roleRouter.post('/', requirePermission('role', 'create'), validate(createRoleSchema), asyncHandler(async (req, res) => {
  const role = await roleService.createRole(req.body);
  res.status(201).json(role);
}));

roleRouter.put('/:id', requirePermission('role', 'edit'), validate(updateRoleSchema), asyncHandler(async (req, res) => {
  res.json(await roleService.updateRole(Number(req.params.id), req.body));
}));

roleRouter.delete('/:id', requirePermission('role', 'delete'), asyncHandler(async (req, res) => {
  res.json(await roleService.deleteRole(Number(req.params.id)));
}));

roleRouter.get('/:id/permissions', requirePermission('role', 'view'), asyncHandler(async (req, res) => {
  res.json(await roleService.getRolePermissions(Number(req.params.id)));
}));

roleRouter.put('/:id/permissions', requirePermission('role', 'edit'), validate(z.object({ permissions: z.array(rolePermissionSchema) })), asyncHandler(async (req, res) => {
  res.json(await roleService.setRolePermissions(Number(req.params.id), req.body.permissions));
}));
