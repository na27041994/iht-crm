-- Nguoi nhap tung dong Job Book (dong cu hien co de trong)
ALTER TABLE "job_bookings" ADD COLUMN "createdById" INTEGER;
ALTER TABLE "job_bookings" ADD COLUMN "createdByName" TEXT;
