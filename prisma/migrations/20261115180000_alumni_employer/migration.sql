-- Alumni employer and privacy choices (lib/graduation.ts). Additive only: three nullable text
-- columns, each bounded to 1-100 characters by a CHECK (as for "phone" in
-- 20261112200000_student_profile_phone; every existing row is NULL, so the checks pass), and two
-- boolean preferences that default to true (a constant default is a catalog-only change in
-- PostgreSQL 11+, so existing rows are not rewritten). No backfill, index, trigger, policy or grant
-- change: StudentProfile is server-only (browser roles have no grant) and the runtime role's
-- table-level grants cover new columns. The columns live on StudentProfile and are deleted with it.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "StudentProfile"
  ADD COLUMN "postGradEmployer" TEXT,
  ADD COLUMN "postGradRole" TEXT,
  ADD COLUMN "postGradPlacementKey" TEXT,
  ADD COLUMN "alumniDirectoryVisible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "alumniPlacementShare" BOOLEAN NOT NULL DEFAULT true,
  ADD CONSTRAINT "StudentProfile_postGradEmployer_length" CHECK ("postGradEmployer" IS NULL OR char_length("postGradEmployer") BETWEEN 1 AND 100),
  ADD CONSTRAINT "StudentProfile_postGradRole_length" CHECK ("postGradRole" IS NULL OR char_length("postGradRole") BETWEEN 1 AND 100),
  ADD CONSTRAINT "StudentProfile_postGradPlacementKey_length" CHECK ("postGradPlacementKey" IS NULL OR char_length("postGradPlacementKey") BETWEEN 1 AND 100);

COMMIT;
