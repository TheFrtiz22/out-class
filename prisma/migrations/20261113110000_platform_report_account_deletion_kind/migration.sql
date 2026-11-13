BEGIN;
SET LOCAL lock_timeout = '5s';
-- Account deletion requests (actions/account-deletion.ts) write PlatformReport rows with
-- kind ACCOUNT_DELETION, but the foundation kind check only allowed USER, CLUB, EVENT,
-- CONTENT and SUPPORT, so every request was rejected by the database. Replace that one
-- check with the same list plus ACCOUNT_DELETION. Existing rows already satisfy it.
-- No table, column, grant, policy or data change.
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
  ADD CONSTRAINT "PlatformReport_kind_check"
    CHECK (kind IN ('USER', 'CLUB', 'EVENT', 'CONTENT', 'SUPPORT', 'ACCOUNT_DELETION'));
COMMIT;
