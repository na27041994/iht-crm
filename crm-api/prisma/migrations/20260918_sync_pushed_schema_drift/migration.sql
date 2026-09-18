-- Đồng bộ các cột/index từng được thêm bằng db push (chưa có migration):
-- advance_voucher_items.kind/description, job_orders pretax/tax/deliveryStaff/source ids,
-- tracking_sheets.phanLuong + containerQuantity Int->String, các index hiệu năng, FK deliveryStaff.
-- Dùng IF NOT EXISTS để chạy an toàn trên DB đã có cột (VD: DB dev push tay).

ALTER TABLE "advance_voucher_items" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "advance_voucher_items" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'Chi';

ALTER TABLE "job_orders" ADD COLUMN IF NOT EXISTS "deliveryStaffId" INTEGER;
ALTER TABLE "job_orders" ADD COLUMN IF NOT EXISTS "pretaxAmount" DECIMAL(15,2);
ALTER TABLE "job_orders" ADD COLUMN IF NOT EXISTS "sourceAdvanceItemId" INTEGER;
ALTER TABLE "job_orders" ADD COLUMN IF NOT EXISTS "sourceAdvanceVoucherId" INTEGER;
ALTER TABLE "job_orders" ADD COLUMN IF NOT EXISTS "taxRate" DECIMAL(5,2);

ALTER TABLE "tracking_sheets" ADD COLUMN IF NOT EXISTS "phanLuong" TEXT;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tracking_sheets' AND column_name = 'containerQuantity' AND data_type = 'integer'
  ) THEN
    ALTER TABLE "tracking_sheets" ALTER COLUMN "containerQuantity" SET DATA TYPE TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "debit_notes_isDelete_sheetId_idx" ON "debit_notes"("isDelete", "sheetId");
CREATE INDEX IF NOT EXISTS "debit_notes_isDelete_type_idx" ON "debit_notes"("isDelete", "type");
CREATE INDEX IF NOT EXISTS "job_bookings_isDelete_sheetId_idx" ON "job_bookings"("isDelete", "sheetId");
CREATE INDEX IF NOT EXISTS "job_bookings_isDelete_type_idx" ON "job_bookings"("isDelete", "type");
CREATE INDEX IF NOT EXISTS "job_orders_isDelete_sheetId_idx" ON "job_orders"("isDelete", "sheetId");
CREATE INDEX IF NOT EXISTS "job_orders_isDelete_type_idx" ON "job_orders"("isDelete", "type");
CREATE INDEX IF NOT EXISTS "job_orders_sourceAdvanceItemId_idx" ON "job_orders"("sourceAdvanceItemId");
CREATE INDEX IF NOT EXISTS "tracking_sheets_isDelete_createdAt_idx" ON "tracking_sheets"("isDelete", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "tracking_sheets_isDelete_etaDate_idx" ON "tracking_sheets"("isDelete", "etaDate");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_orders_deliveryStaffId_fkey') THEN
    ALTER TABLE "job_orders" ADD CONSTRAINT "job_orders_deliveryStaffId_fkey" FOREIGN KEY ("deliveryStaffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
