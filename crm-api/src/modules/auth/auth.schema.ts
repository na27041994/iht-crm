import { z } from 'zod';

export const userRoles = ['admin', 'sales', 'ops', 'accountant', 'viewer'] as const;
export type UserRoleValue = (typeof userRoles)[number];

export const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

export type LoginInput = z.infer<typeof loginSchema>;

const optionalText = z.string().optional().nullable();

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
  fullName: z.string().min(2, 'Tên tối thiểu 2 ký tự'),
  chineseName: optionalText,
  cccd: optionalText,
  phone: optionalText,
  address: optionalText,
  avatarUrl: optionalText,
  role: z.enum(userRoles),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    fullName: z.string().min(2, 'Tên tối thiểu 2 ký tự').optional(),
    chineseName: optionalText,
    cccd: optionalText,
    phone: optionalText,
    address: optionalText,
    avatarUrl: optionalText,
    role: z.enum(userRoles).optional(),
    isActive: z.boolean().optional(),
    password: z
      .string()
      .min(6, 'Mật khẩu tối thiểu 6 ký tự')
      .optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'Không có trường nào để cập nhật',
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
