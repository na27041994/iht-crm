import type { Request, Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth.js';
import { hasPermission } from '../modules/permissions/permissions.service.js';
import type { Resource, Action } from '../modules/permissions/permissions.constants.js';

// Middleware kiểm quyền: requirePermission(resource, action)
export function requirePermission(resource: Resource, action: Action) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Chưa xác thực' });
    }
    try {
      const ok = await hasPermission(req.user.sub, resource, action);
      if (!ok) {
        return res.status(403).json({ error: `Bạn không có quyền ${action} ${resource}` });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
