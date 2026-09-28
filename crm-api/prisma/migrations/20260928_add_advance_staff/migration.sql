-- Nhan vien ung tien cua phieu chi tam ung (nullable: null = theo nguoi tao)
ALTER TABLE "advance_vouchers" ADD COLUMN IF NOT EXISTS "advanceStaffId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'advance_vouchers_advanceStaffId_fkey') THEN
    ALTER TABLE "advance_vouchers" ADD CONSTRAINT "advance_vouchers_advanceStaffId_fkey" FOREIGN KEY ("advanceStaffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "advance_vouchers_advanceStaffId_idx" ON "advance_vouchers"("advanceStaffId");
