-- Bỏ quản lý Hãng tàu: TrackingSheet.carrierId (FK) -> carrierName (nhập tay),
-- xóa bảng carriers. Dữ liệu hãng tàu cũ không giữ (theo yêu cầu).
ALTER TABLE "tracking_sheets" DROP CONSTRAINT IF EXISTS "tracking_sheets_carrierId_fkey";
ALTER TABLE "tracking_sheets" DROP COLUMN IF EXISTS "carrierId";
ALTER TABLE "tracking_sheets" ADD COLUMN IF NOT EXISTS "carrierName" TEXT;
DROP TABLE IF EXISTS "carriers";
