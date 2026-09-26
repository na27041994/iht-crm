import { Router } from 'express';
import { asyncHandler } from '../../middleware/error.js';
import { validate, validateQuery } from '../../middleware/validate.js';
import { requireAuth, type AuthedRequest } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { hasPermission } from '../permissions/permissions.service.js';
import { leaveRequestSchema, listLeaveRequestsQuery, approveLeaveSchema } from './leaveRequest.schema.js';
import {
  listLeaveRequests,
  createLeaveRequest,
  updateLeaveRequest,
  deleteLeaveRequest,
  decideLeaveRequest,
} from './leaveRequest.service.js';

export const leaveRequestRouter = Router();

leaveRequestRouter.use(requireAuth);

leaveRequestRouter.get(
  '/',
  validateQuery(listLeaveRequestsQuery),
  requirePermission('leave_request', 'view'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { status, userId, page, pageSize } = req.query as unknown as {
      status?: string;
      userId?: number;
      page: number;
      pageSize: number;
    };
    const canViewAll = await hasPermission(req.user!.sub, 'leave_request' as any, 'edit');
    res.json(await listLeaveRequests(req.user!.sub, canViewAll, { status, userId, page, pageSize }));
  }),
);

leaveRequestRouter.post(
  '/',
  validate(leaveRequestSchema),
  requirePermission('leave_request', 'create'),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.status(201).json(await createLeaveRequest(req.user!.sub, req.body));
  }),
);

// Sửa/xóa đơn chờ duyệt của chính mình chỉ cần quyền xem (service kiểm chủ đơn);
// sửa đơn người khác / duyệt cần quyền edit, xóa đơn người khác cần quyền delete
leaveRequestRouter.put(
  '/:id',
  validate(leaveRequestSchema),
  requirePermission('leave_request', 'view'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const canEditAll = await hasPermission(req.user!.sub, 'leave_request' as any, 'edit');
    res.json(await updateLeaveRequest(Number(req.params.id), req.user!.sub, canEditAll, req.body));
  }),
);

leaveRequestRouter.delete(
  '/:id',
  requirePermission('leave_request', 'view'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const canDeleteAll = await hasPermission(req.user!.sub, 'leave_request' as any, 'delete');
    await deleteLeaveRequest(Number(req.params.id), req.user!.sub, canDeleteAll);
    res.json({ success: true });
  }),
);

leaveRequestRouter.post(
  '/:id/approve',
  validate(approveLeaveSchema),
  requirePermission('leave_request', 'edit'),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await decideLeaveRequest(Number(req.params.id), req.user!.sub, true, (req.body as any)?.approveNote ?? null));
  }),
);

leaveRequestRouter.post(
  '/:id/reject',
  validate(approveLeaveSchema),
  requirePermission('leave_request', 'edit'),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await decideLeaveRequest(Number(req.params.id), req.user!.sub, false, (req.body as any)?.approveNote ?? null));
  }),
);
