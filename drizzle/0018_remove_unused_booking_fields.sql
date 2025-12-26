-- Remove unused booking fields
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "service_category";
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "duration";
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "staff_member_name";
