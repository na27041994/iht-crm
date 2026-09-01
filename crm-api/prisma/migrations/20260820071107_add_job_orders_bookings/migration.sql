-- CreateTable
CREATE TABLE "job_orders" (
    "id" SERIAL NOT NULL,
    "sheetId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "portAmt" DECIMAL(15,2),
    "industry" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_bookings" (
    "id" SERIAL NOT NULL,
    "sheetId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "quantity" DECIMAL(12,2),
    "pretaxAmount" DECIMAL(15,2),
    "taxRate" DECIMAL(5,2),
    "taxAmount" DECIMAL(15,2),
    "afterTaxAmount" DECIMAL(15,2),
    "total" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_orders_sheetId_idx" ON "job_orders"("sheetId");

-- CreateIndex
CREATE INDEX "job_bookings_sheetId_idx" ON "job_bookings"("sheetId");

-- AddForeignKey
ALTER TABLE "job_orders" ADD CONSTRAINT "job_orders_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "tracking_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_bookings" ADD CONSTRAINT "job_bookings_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "tracking_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
