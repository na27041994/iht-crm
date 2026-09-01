-- AlterTable
ALTER TABLE "tracking_sheets" ADD COLUMN     "createdById" INTEGER;

-- AddForeignKey
ALTER TABLE "tracking_sheets" ADD CONSTRAINT "tracking_sheets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
