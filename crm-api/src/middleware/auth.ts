import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type TokenPayload } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

export interface AuthedRequest extends Request {
  user?: TokenPayload & { fullName?: string };
}

// Middleware xác thực JWT: requireAuth
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Thiếu token xác thực' });
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

// Hàm requireRole: xử lý requireRole
export function requireRole(...roles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này' });
    }
    next();
  };
}

// Hàm loadUserContext: xử lý loadUserContext
export async function loadUserContext(req: AuthedRequest, _res: Response, next: NextFunction) {
  if (req.user) {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (user && user.isActive) {
      req.user.fullName = user.fullName;
    }
  }
  next();
}
