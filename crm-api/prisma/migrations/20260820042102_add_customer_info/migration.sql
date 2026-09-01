/*
  Warnings:

  - Added the required column `customerName` to the `customers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "fax" TEXT;

-- Backfill dữ liệu hiện có từ companyName
UPDATE "customers" SET "customerName" = "companyName" WHERE "customerName" IS NULL;

ALTER TABLE "customers" ALTER COLUMN "customerName" SET NOT NULL;
