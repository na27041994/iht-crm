-- Luồng duyệt chỉ áp dụng cho phiếu Chi trực tiếp; các loại còn lại không cần duyệt
UPDATE "advance_vouchers"
SET "approvalStatus" = 'not_required'
WHERE "type" <> 'Chi trực tiếp';
