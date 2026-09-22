-- Khôi phục quản lý Hãng tàu: tạo lại bảng carriers,
-- TrackingSheet.carrierName (nhập tay) -> carrierId (FK).
CREATE TABLE IF NOT EXISTS "carriers" (
    "id" SERIAL NOT NULL,
    "carrierName" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "taxCode" TEXT,
    "contactPerson" TEXT,
    "note" TEXT,
    "isDelete" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "carriers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "carriers_companyName_idx" ON "carriers"("companyName");
ALTER TABLE "tracking_sheets" ADD COLUMN IF NOT EXISTS "carrierId" INTEGER;
ALTER TABLE "tracking_sheets" DROP COLUMN IF EXISTS "carrierName";
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tracking_sheets_carrierId_fkey') THEN
    ALTER TABLE "tracking_sheets" ADD CONSTRAINT "tracking_sheets_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
