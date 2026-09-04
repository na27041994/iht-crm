import { z } from 'zod';

export const createRoleSchema = z.object({
  name: z.string().min(2).max(30).regex(/^[a-z0-9_]+$/, 'Tên vai trò chỉ gồm chữ thường, số và _'),
  displayName: z.string().min(2).max(50),
  description: z.string().max(200).optional().nullable(),
});

export const updateRoleSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  description: z.string().max(200).optional().nullable(),
});

export const rolePermissionSchema = z.object({
  resource: z.string().min(1),
  canView: z.boolean(),
  canCreate: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
