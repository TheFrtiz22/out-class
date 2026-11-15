BEGIN;
SET LOCAL lock_timeout = '5s';
-- Per-club pilot feature switches, written only by platform admins. Additive and nullable:
-- existing rows keep NULL, which the app reads as every feature off. No backfill, grants,
-- triggers or RLS change. See lib/club-features.ts.
ALTER TABLE "Club" ADD COLUMN "features" JSONB,
 ADD CONSTRAINT "Club_features_object" CHECK (
  "features" IS NULL OR jsonb_typeof("features") = 'object'
 );
COMMIT;
