-- Lien ket 1-1 Debit Note <-> Job Book tau (sua/xoa dong bo 2 chieu)
ALTER TABLE "debit_notes" ADD COLUMN IF NOT EXISTS "sourceBookingId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debit_notes_sourceBookingId_fkey') THEN
    ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_sourceBookingId_fkey" FOREIGN KEY ("sourceBookingId") REFERENCES "job_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "debit_notes_sourceBookingId_key" ON "debit_notes"("sourceBookingId");
