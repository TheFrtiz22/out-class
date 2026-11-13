BEGIN;
SET LOCAL lock_timeout = '5s';
-- Issue reports and feedback from signed-in people (lib/feedback-reports.ts). Reuses
-- PlatformReport: replaces the kind check (as left by 20261113110000, which added
-- ACCOUNT_DELETION) with the same list plus ISSUE and FEEDBACK. Adds a nullable
-- "context" object (page, device, build, optional screenshot path) that only those two kinds
-- may carry, bounded in size. Existing rows satisfy the replacement unchanged and keep NULL.
-- No new table, grant, policy, trigger or backfill: RLS and the server-only policy stay.
DO $$
DECLARE c RECORD; dropped INTEGER := 0;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid = '"PlatformReport"'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%SUPPORT%'
  LOOP
    EXECUTE format('ALTER TABLE "PlatformReport" DROP CONSTRAINT %I', c.conname);
    dropped := dropped + 1;
  END LOOP;
  IF dropped <> 1 THEN RAISE EXCEPTION 'Expected the one report kind check, found %', dropped; END IF;
END $$;
ALTER TABLE "PlatformReport"
  ADD COLUMN "context" JSONB,
  ADD CONSTRAINT "PlatformReport_kind_check"
    CHECK (kind IN ('USER', 'CLUB', 'EVENT', 'CONTENT', 'SUPPORT', 'ACCOUNT_DELETION', 'ISSUE', 'FEEDBACK')),
  ADD CONSTRAINT "PlatformReport_context_check" CHECK (
    "context" IS NULL OR (
      kind IN ('ISSUE', 'FEEDBACK')
      AND jsonb_typeof("context") = 'object'
      AND octet_length("context"::text) <= 4096
    )
  );
COMMIT;
