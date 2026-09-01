-- CreateTable
CREATE TABLE "tracking_sheets" (
    "id" SERIAL NOT NULL,
    "sheetNumber" TEXT NOT NULL,
    "docStaffId" INTEGER,
    "deliveryStaffId" INTEGER,
    "nw" DECIMAL(12,2),
    "containerNumber" TEXT,
    "customerId" INTEGER,
    "fromLocation" TEXT,
    "toLocation" TEXT,
    "containerQuantity" INTEGER,
    "etaDate" DATE,
    "gw" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracking_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracking_sheets_sheetNumber_key" ON "tracking_sheets"("sheetNumber");

-- CreateIndex
CREATE INDEX "tracking_sheets_sheetNumber_idx" ON "tracking_sheets"("sheetNumber");

-- CreateIndex
CREATE INDEX "tracking_sheets_customerId_idx" ON "tracking_sheets"("customerId");

-- CreateIndex
CREATE INDEX "tracking_sheets_createdAt_idx" ON "tracking_sheets"("createdAt");

-- AddForeignKey
ALTER TABLE "tracking_sheets" ADD CONSTRAINT "tracking_sheets_docStaffId_fkey" FOREIGN KEY ("docStaffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_sheets" ADD CONSTRAINT "tracking_sheets_deliveryStaffId_fkey" FOREIGN KEY ("deliveryStaffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_sheets" ADD CONSTRAINT "tracking_sheets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
