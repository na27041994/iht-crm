-- Thong tin consignee / shipper cua phieu theo doi
ALTER TABLE "tracking_sheets" ADD COLUMN IF NOT EXISTS "consignee" TEXT;
ALTER TABLE "tracking_sheets" ADD COLUMN IF NOT EXISTS "shipper" TEXT;
