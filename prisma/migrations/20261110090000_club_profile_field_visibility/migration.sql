BEGIN;
SET LOCAL lock_timeout = '5s';
-- Per-club choice of which applicant profile fields leaders see. Additive and nullable:
-- existing rows keep NULL, which the app reads as the defaults (every field on except GPA
-- and LinkedIn). No backfill, grants, triggers or RLS change.
ALTER TABLE "Club" ADD COLUMN "profileFieldVisibility" JSONB,
 ADD CONSTRAINT "Club_profileFieldVisibility_object" CHECK (
  "profileFieldVisibility" IS NULL OR jsonb_typeof("profileFieldVisibility") = 'object'
 );
COMMIT;
