import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

// Middleware validate: kiểm tra schema zod cho body/query
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
}

// Middleware validate: kiểm tra schema zod cho body/query
export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.query = result.data as Record<string, string>;
    next();
  };
}
