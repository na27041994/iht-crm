-- Ghi chu cho Job Book tau
ALTER TABLE "job_bookings" ADD COLUMN IF NOT EXISTS "note" TEXT;
