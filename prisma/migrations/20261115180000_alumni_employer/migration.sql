-- Alumni employer and privacy choices (lib/graduation.ts). Additive only: two nullable text
-- columns, each bounded to 1-100 characters by a CHECK (as for "phone" in
-- 20261112200000_student_profile_phone; every existing row is NULL, so the checks pass), two
-- boolean preferences that default to true, and the list of clubs that already received the
-- graduate's employer (at most once per club; empty by default, at most 1000 entries). Constant
-- defaults are a catalog-only change in PostgreSQL 11+, so existing rows are not rewritten. No
-- backfill, index, trigger, policy or grant change: StudentProfile is server-only (browser roles have no grant) and the runtime role's
-- table-level grants cover new columns. The columns live on StudentProfile and are deleted with it.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "StudentProfile"
  ADD COLUMN "postGradEmployer" TEXT,
  ADD COLUMN "postGradRole" TEXT,
  ADD COLUMN "alumniPlacementClubIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "alumniDirectoryVisible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "alumniPlacementShare" BOOLEAN NOT NULL DEFAULT true,
  ADD CONSTRAINT "StudentProfile_postGradEmployer_length" CHECK ("postGradEmployer" IS NULL OR char_length("postGradEmployer") BETWEEN 1 AND 100),
  ADD CONSTRAINT "StudentProfile_postGradRole_length" CHECK ("postGradRole" IS NULL OR char_length("postGradRole") BETWEEN 1 AND 100),
  ADD CONSTRAINT "StudentProfile_alumniPlacementClubIds_size" CHECK (cardinality("alumniPlacementClubIds") <= 1000);

COMMIT;
