-- AlterTable
ALTER TABLE "job_bookings" ADD COLUMN     "agentId" INTEGER,
ADD COLUMN     "carrierId" INTEGER;

-- AlterTable
ALTER TABLE "job_orders" ADD COLUMN     "agentId" INTEGER,
ADD COLUMN     "carrierId" INTEGER;

-- CreateIndex
CREATE INDEX "job_bookings_carrierId_idx" ON "job_bookings"("carrierId");

-- CreateIndex
CREATE INDEX "job_bookings_agentId_idx" ON "job_bookings"("agentId");

-- CreateIndex
CREATE INDEX "job_orders_carrierId_idx" ON "job_orders"("carrierId");

-- CreateIndex
CREATE INDEX "job_orders_agentId_idx" ON "job_orders"("agentId");

-- AddForeignKey
ALTER TABLE "job_orders" ADD CONSTRAINT "job_orders_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_orders" ADD CONSTRAINT "job_orders_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_bookings" ADD CONSTRAINT "job_bookings_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_bookings" ADD CONSTRAINT "job_bookings_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
