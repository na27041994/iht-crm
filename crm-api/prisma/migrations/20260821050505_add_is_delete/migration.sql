-- AlterTable
ALTER TABLE "advance_voucher_items" ADD COLUMN     "isDelete" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "advance_vouchers" ADD COLUMN     "isDelete" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "isDelete" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "carriers" ADD COLUMN     "isDelete" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "isDelete" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "isDelete" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "debit_notes" ADD COLUMN     "isDelete" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "job_bookings" ADD COLUMN     "isDelete" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "job_orders" ADD COLUMN     "isDelete" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "tracking_sheets" ADD COLUMN     "isDelete" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "truckers" ADD COLUMN     "isDelete" INTEGER NOT NULL DEFAULT 1;
