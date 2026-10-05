-- Doi Qty phieu chi sang text de nhan ca so va chu (vd 2 / 4.47CBM), giu nguyen gia tri so cu
ALTER TABLE "advance_vouchers" ALTER COLUMN "qty" TYPE TEXT USING "qty"::TEXT;
