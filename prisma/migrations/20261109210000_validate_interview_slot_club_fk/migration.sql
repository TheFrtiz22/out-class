-- Ledger parity (docs/agent-ops/migration-reconciliation-2026-11-09.md).
-- 20260924020000_interview_kits adds "InterviewSlot_clubId_fkey" as NOT VALID and no later
-- migration validates it. Production already has the constraint validated, so a database
-- built from the ledger alone was weaker than production. This validates it everywhere.
-- Forward-only and idempotent: on a database where the constraint is already valid
-- (production) nothing is scanned and nothing changes. Validation takes SHARE UPDATE
-- EXCLUSIVE on "InterviewSlot" (reads and writes continue) and ROW SHARE on "Club".
-- If any slot references a missing club the migration fails and changes nothing; no row
-- is modified or deleted to make it pass.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'InterviewSlot_clubId_fkey'
      AND conrelid = 'public."InterviewSlot"'::regclass
      AND NOT convalidated
  ) THEN
    ALTER TABLE public."InterviewSlot" VALIDATE CONSTRAINT "InterviewSlot_clubId_fkey";
  END IF;
END
$migration$;
COMMIT;
