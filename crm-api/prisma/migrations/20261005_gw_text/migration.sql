-- Doi GW phieu theo doi sang text de nhap nhieu so (moi dong 1 so), giu nguyen gia tri so cu
ALTER TABLE "tracking_sheets" ALTER COLUMN "gw" TYPE TEXT USING "gw"::TEXT;
