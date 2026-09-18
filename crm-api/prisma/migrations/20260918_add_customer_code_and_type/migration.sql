-- Thêm phân loại khách (KH/DL) + mã khách hàng tự sinh (prefix + id đệm 5 số 0)
ALTER TABLE "customers" ADD COLUMN "customerType" TEXT NOT NULL DEFAULT 'KH';

ALTER TABLE "customers" ADD COLUMN "code" TEXT;

-- Backfill mã cho khách hiện có (mặc định loại KH)
UPDATE "customers" SET "code" = 'KH' || LPAD("id"::text, 5, '0') WHERE "code" IS NULL;

CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");
