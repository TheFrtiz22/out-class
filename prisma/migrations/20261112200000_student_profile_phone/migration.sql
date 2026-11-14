BEGIN;
SET LOCAL lock_timeout = '5s';
-- Applicant phone number, so a club's decision managers can call an applicant they are
-- accepting. Additive and nullable: existing rows keep NULL and the app asks for a number
-- before the student's next application is submitted. Stored in E.164. No backfill, grants,
-- triggers or RLS change. See lib/phone.ts.
ALTER TABLE "StudentProfile" ADD COLUMN "phone" TEXT,
 ADD CONSTRAINT "StudentProfile_phone_e164" CHECK (
  "phone" IS NULL OR "phone" ~ '^\+[1-9][0-9]{7,14}$'
 );
COMMIT;
