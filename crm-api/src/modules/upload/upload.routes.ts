import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler, AppError } from '../../middleware/error.js';
import { isAllowedImage, processAvatar } from './upload.service.js';

export const uploadRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedImage(file.mimetype)) cb(null, true);
    else cb(new AppError('Chỉ chấp nhận file ảnh (JPEG, PNG, WebP, GIF, AVIF)', 400));
  },
});

uploadRouter.post(
  '/avatar',
  requireAuth,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError('Vui lòng chọn file ảnh', 400);
    }
    try {
      const result = await processAvatar(req.file.buffer);
      res.status(201).json(result);
    } catch {
      throw new AppError('Không thể xử lý ảnh. File có thể bị hỏng hoặc không phải ảnh hợp lệ', 400);
    }
  }),
);