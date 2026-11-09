BEGIN;
SET LOCAL lock_timeout = '5s';
-- Optional club nickname for navigation (e.g. "MIIx"). Additive and nullable: existing rows keep
-- NULL and fall back to an abbreviation of the name in the app. No grants, triggers or RLS change.
-- The CHECK mirrors the server's validation (2–8 letters, digits, "&", "-" or spaces, trimmed).
ALTER TABLE "Club" ADD COLUMN "shortName" TEXT,
 ADD CONSTRAINT "Club_shortName_format" CHECK (
  "shortName" IS NULL OR (
   char_length("shortName") BETWEEN 2 AND 8
   AND "shortName" ~ '^[A-Za-z0-9& -]+$'
   AND "shortName" = btrim("shortName")
  )
 );
COMMIT;
