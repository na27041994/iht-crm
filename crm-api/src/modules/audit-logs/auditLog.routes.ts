import { Router } from 'express';
import { asyncHandler } from '../../middleware/error.js';
import { validateQuery } from '../../middleware/validate.js';
import { requireAuth, type AuthedRequest } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { listAuditLogsQuery } from './auditLog.schema.js';
import { listAuditLogs } from './auditLog.service.js';

export const auditLogRouter = Router();

auditLogRouter.use(requireAuth, requirePermission('audit_log', 'view'));

auditLogRouter.get(
  '/',
  validateQuery(listAuditLogsQuery),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { page, pageSize, userId, action, entity, from, to } = req.query as unknown as {
      page: number;
      pageSize: number;
      userId?: number;
      action?: string;
      entity?: string;
      from?: Date;
      to?: Date;
    };
    res.json(await listAuditLogs({ page, pageSize, userId, action, entity, from, to }));
  }),
);