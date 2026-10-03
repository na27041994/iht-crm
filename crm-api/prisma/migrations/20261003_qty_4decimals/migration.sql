-- Mo rong so thap phan cho so luong / can nang (12,2 -> 14,4), tien giu nguyen chuan x100
ALTER TABLE "tracking_sheets" ALTER COLUMN "nw" TYPE DECIMAL(14,4);
ALTER TABLE "tracking_sheets" ALTER COLUMN "gw" TYPE DECIMAL(14,4);
ALTER TABLE "job_bookings" ALTER COLUMN "quantity" TYPE DECIMAL(14,4);
ALTER TABLE "debit_notes" ALTER COLUMN "quantity" TYPE DECIMAL(14,4);
ALTER TABLE "advance_vouchers" ALTER COLUMN "qty" TYPE DECIMAL(14,4);
ALTER TABLE "quote_items" ALTER COLUMN "quantity" TYPE DECIMAL(14,4);
