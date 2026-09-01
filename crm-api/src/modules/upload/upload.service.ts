import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import { AppError } from '../../middleware/error.js';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
const AVATAR_DIR = path.join(UPLOAD_DIR, 'avatars');
const AVATAR_SIZE = 256;

// Hàm ensureUploadDirs: xử lý ensureUploadDirs
export function ensureUploadDirs() {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
];

// Hàm isAllowedImage: xử lý isAllowedImage
export function isAllowedImage(mimetype: string) {
  return ALLOWED_IMAGE_TYPES.includes(mimetype);
}

/**
 * Tối ưu ảnh avatar: resize 256x256 (cover), chuyển webp, nén 80%.
 * Trả về đường dẫn tương đối để lưu vào DB.
 */
// Hàm processAvatar: xử lý processAvatar
export async function processAvatar(buffer: Buffer): Promise<{ url: string; size: number }> {
  ensureUploadDirs();

  const name = `${randomUUID()}.webp`;
  const outPath = path.join(AVATAR_DIR, name);

  const meta = await sharp(buffer)
    .rotate()
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'attention' })
    .webp({ quality: 80, effort: 4 })
    .toFile(outPath);

  return { url: `/uploads/avatars/${name}`, size: meta.size };
}