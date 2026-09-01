/*
  Warnings:

  - You are about to drop the column `leadId` on the `activities` table. All the data in the column will be lost.
  - You are about to drop the column `opportunityId` on the `activities` table. All the data in the column will be lost.
  - You are about to drop the column `opportunityId` on the `quotes` table. All the data in the column will be lost.
  - You are about to drop the `leads` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `opportunities` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_leadId_fkey";

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_opportunityId_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_convertedCustomerId_fkey";

-- DropForeignKey
ALTER TABLE "opportunities" DROP CONSTRAINT "opportunities_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "opportunities" DROP CONSTRAINT "opportunities_customerId_fkey";

-- DropForeignKey
ALTER TABLE "opportunities" DROP CONSTRAINT "opportunities_leadId_fkey";

-- DropForeignKey
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_opportunityId_fkey";

-- DropIndex
DROP INDEX "activities_customerId_opportunityId_orderId_idx";

-- AlterTable
ALTER TABLE "activities" DROP COLUMN "leadId",
DROP COLUMN "opportunityId";

-- AlterTable
ALTER TABLE "quotes" DROP COLUMN "opportunityId";

-- DropTable
DROP TABLE "leads";

-- DropTable
DROP TABLE "opportunities";

-- DropEnum
DROP TYPE "LeadStatus";

-- DropEnum
DROP TYPE "OppStage";

-- CreateIndex
CREATE INDEX "activities_customerId_orderId_idx" ON "activities"("customerId", "orderId");
