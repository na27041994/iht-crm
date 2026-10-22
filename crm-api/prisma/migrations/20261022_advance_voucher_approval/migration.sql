-- Phiếu chi: thêm luồng duyệt trên web
ALTER TABLE "advance_vouchers" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "advance_vouchers" ADD COLUMN "submittedById" INTEGER;
ALTER TABLE "advance_vouchers" ADD COLUMN "submittedByName" TEXT;
ALTER TABLE "advance_vouchers" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "advance_vouchers" ADD COLUMN "deptApprovedById" INTEGER;
ALTER TABLE "advance_vouchers" ADD COLUMN "deptApprovedByName" TEXT;
ALTER TABLE "advance_vouchers" ADD COLUMN "deptApprovedAt" TIMESTAMP(3);
ALTER TABLE "advance_vouchers" ADD COLUMN "deptApproveNote" TEXT;
ALTER TABLE "advance_vouchers" ADD COLUMN "accountantApprovedById" INTEGER;
ALTER TABLE "advance_vouchers" ADD COLUMN "accountantApprovedByName" TEXT;
ALTER TABLE "advance_vouchers" ADD COLUMN "accountantApprovedAt" TIMESTAMP(3);
ALTER TABLE "advance_vouchers" ADD COLUMN "accountantApproveNote" TEXT;
ALTER TABLE "advance_vouchers" ADD COLUMN "paidById" INTEGER;
ALTER TABLE "advance_vouchers" ADD COLUMN "paidByName" TEXT;
ALTER TABLE "advance_vouchers" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "advance_vouchers" ADD COLUMN "paidNote" TEXT;
ALTER TABLE "advance_vouchers" ADD COLUMN "receivedById" INTEGER;
ALTER TABLE "advance_vouchers" ADD COLUMN "receivedByName" TEXT;
ALTER TABLE "advance_vouchers" ADD COLUMN "receivedAt" TIMESTAMP(3);
ALTER TABLE "advance_vouchers" ADD COLUMN "receivedNote" TEXT;
ALTER TABLE "advance_vouchers" ADD COLUMN "rejectReason" TEXT;
ALTER TABLE "advance_vouchers" ADD COLUMN "rejectedById" INTEGER;
ALTER TABLE "advance_vouchers" ADD COLUMN "rejectedByName" TEXT;
ALTER TABLE "advance_vouchers" ADD COLUMN "rejectedAt" TIMESTAMP(3);

-- Phiếu cũ đã ký giấy: coi như đã duyệt để không chặn dữ liệu
UPDATE "advance_vouchers" SET "approvalStatus" = 'approved';

CREATE TABLE "advance_voucher_logs" (
    "id" SERIAL NOT NULL,
    "voucherId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "byId" INTEGER,
    "byName" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "advance_voucher_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "advance_voucher_logs_voucherId_idx" ON "advance_voucher_logs"("voucherId");
ALTER TABLE "advance_voucher_logs" ADD CONSTRAINT "advance_voucher_logs_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "advance_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Quyền duyệt / chi tiền riêng cho phiếu chi
ALTER TABLE "role_permissions" ADD COLUMN "canApprove" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "role_permissions" ADD COLUMN "canPay" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_permissions" ADD COLUMN "canApprove" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_permissions" ADD COLUMN "canPay" BOOLEAN NOT NULL DEFAULT false;

UPDATE "role_permissions" rp
SET "canApprove" = true, "canPay" = true
FROM "roles" r
WHERE r."id" = rp."roleId" AND r."name" = 'accountant' AND rp."resource" = 'advance_voucher';

UPDATE "user_permissions" up
SET "canApprove" = true, "canPay" = true
FROM "users" u
WHERE u."id" = up."userId" AND u."role" = 'accountant' AND up."resource" = 'advance_voucher';
