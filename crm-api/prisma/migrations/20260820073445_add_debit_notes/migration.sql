-- CreateTable
CREATE TABLE "debit_notes" (
    "id" SERIAL NOT NULL,
    "sheetId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "description" TEXT,
    "unit" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "quantity" DECIMAL(12,2),
    "priceVnd" DECIMAL(15,2),
    "taxRate" DECIMAL(5,2),
    "priceUsd" DECIMAL(15,2),
    "exchangeRate" DECIMAL(15,4),
    "total" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "debit_notes_sheetId_idx" ON "debit_notes"("sheetId");

-- AddForeignKey
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "tracking_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
