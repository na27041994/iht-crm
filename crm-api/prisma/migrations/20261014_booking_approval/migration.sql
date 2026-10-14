-- Duyet ke toan cho dong cuoc cont / cuoc sua chua cont (Job Book tau)
ALTER TABLE "job_bookings" ADD COLUMN "approvalStatus" TEXT;
ALTER TABLE "job_bookings" ADD COLUMN "approvedById" INTEGER;
ALTER TABLE "job_bookings" ADD COLUMN "approvedByName" TEXT;
ALTER TABLE "job_bookings" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "job_bookings" ADD COLUMN "rejectReason" TEXT;

-- Cac dong cuoc hien co ve trang thai cho duyet
UPDATE "job_bookings" SET "approvalStatus" = 'pending' WHERE "isDelete" = 1 AND "type" IN ('Cược Cont', 'Cược sửa chữa cont');
