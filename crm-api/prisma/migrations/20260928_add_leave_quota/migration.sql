-- Quota ngay phep nam theo nhan vien (mac dinh 12 ngay/nam)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "annualLeaveQuota" DECIMAL(5,1) NOT NULL DEFAULT 12;
