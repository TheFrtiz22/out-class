-- Alumni status (lib/graduation.ts). Additive only: four nullable columns, no default, no backfill,
-- no constraint, index, trigger, policy or grant change. Adding a nullable column without a default
-- is a catalog-only change, so the ACCESS EXCLUSIVE lock is held only briefly. Both tables are
-- server-only (browser roles have no grant; see 20261002010000 and 20260923010000), and table-level
-- grants of the existing runtime role cover new columns, so no grant is needed.
-- Existing rows start as current students and active members; the daily graduation job
-- (/api/internal/graduation) sets these columns after deploy.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "StudentProfile"
  ADD COLUMN "graduatedAt" TIMESTAMP(3),
  ADD COLUMN "graduationConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "graduationPromptDismissedAt" TIMESTAMP(3);

ALTER TABLE "ClubMember" ADD COLUMN "alumniSince" TIMESTAMP(3);

COMMIT;
