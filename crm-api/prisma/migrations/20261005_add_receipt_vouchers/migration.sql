-- Them bang phieu thu (receipt vouchers): T + YYMMDD + seq, tien luu x100 chuan money
CREATE TABLE "receipt_vouchers" (
    "id" SERIAL NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "payerType" TEXT NOT NULL,
    "receiptDate" DATE NOT NULL,
    "customerId" INTEGER,
    "payerName" TEXT,
    "staffId" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "amount" DECIMAL(15,2) NOT NULL,
    "transFee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "isDelete" INTEGER NOT NULL DEFAULT 1,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_vouchers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "receipt_vouchers_receiptNo_key" ON "receipt_vouchers"("receiptNo");
CREATE INDEX "receipt_vouchers_receiptNo_idx" ON "receipt_vouchers"("receiptNo");
CREATE INDEX "receipt_vouchers_customerId_idx" ON "receipt_vouchers"("customerId");
CREATE INDEX "receipt_vouchers_receiptDate_idx" ON "receipt_vouchers"("receiptDate");
CREATE INDEX "receipt_vouchers_staffId_idx" ON "receipt_vouchers"("staffId");

ALTER TABLE "receipt_vouchers" ADD CONSTRAINT "receipt_vouchers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "receipt_vouchers" ADD CONSTRAINT "receipt_vouchers_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "receipt_vouchers" ADD CONSTRAINT "receipt_vouchers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
