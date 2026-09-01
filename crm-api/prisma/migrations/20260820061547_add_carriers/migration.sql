-- CreateTable
CREATE TABLE "carriers" (
    "id" SERIAL NOT NULL,
    "carrierName" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "taxCode" TEXT,
    "contactPerson" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carriers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "carriers_companyName_idx" ON "carriers"("companyName");
