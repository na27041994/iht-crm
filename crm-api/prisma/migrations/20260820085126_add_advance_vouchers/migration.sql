-- CreateTable
CREATE TABLE "advance_vouchers" (
    "id" SERIAL NOT NULL,
    "advanceNo" TEXT NOT NULL,
    "sheetId" INTEGER,
    "type" TEXT NOT NULL,
    "advanceDate" DATE NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "customerId" INTEGER,
    "orderFrom" TEXT,
    "orderTo" TEXT,
    "containerQty" INTEGER,
    "qty" DECIMAL(12,2),
    "note" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advance_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_voucher_items" (
    "id" SERIAL NOT NULL,
    "voucherId" INTEGER NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advance_voucher_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "advance_vouchers_advanceNo_key" ON "advance_vouchers"("advanceNo");

-- CreateIndex
CREATE INDEX "advance_vouchers_advanceNo_idx" ON "advance_vouchers"("advanceNo");

-- CreateIndex
CREATE INDEX "advance_vouchers_sheetId_idx" ON "advance_vouchers"("sheetId");

-- CreateIndex
CREATE INDEX "advance_vouchers_customerId_idx" ON "advance_vouchers"("customerId");

-- CreateIndex
CREATE INDEX "advance_vouchers_advanceDate_idx" ON "advance_vouchers"("advanceDate");

-- CreateIndex
CREATE INDEX "advance_voucher_items_voucherId_idx" ON "advance_voucher_items"("voucherId");

-- AddForeignKey
ALTER TABLE "advance_vouchers" ADD CONSTRAINT "advance_vouchers_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "tracking_sheets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_vouchers" ADD CONSTRAINT "advance_vouchers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_vouchers" ADD CONSTRAINT "advance_vouchers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_voucher_items" ADD CONSTRAINT "advance_voucher_items_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "advance_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
