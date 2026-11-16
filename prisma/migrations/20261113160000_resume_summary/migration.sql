-- Cached deterministic résumé section summaries (lib/resume-summary.ts, utils/resume-summary.ts).
-- Additive only: no existing table, trigger, grant or row changes; no backfill (summaries are built
-- on first view). Server-only like StudentInterestProfile (20261112140000): RLS on, no browser-role
-- access, and only the bounded runtime role with explicit policies. Rows are a cache of a document
-- the reader was already authorized to open: never updated (a parser change writes a new version),
-- deleted with the account (explicitly, and by ON DELETE CASCADE from "User").
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE "ResumeSummary" (
 "id" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "contentHash" TEXT NOT NULL,
 "parserVersion" INTEGER NOT NULL,
 "summary" JSONB NOT NULL,
 "confidence" DOUBLE PRECISION NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ResumeSummary_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ResumeSummary_contentHash" CHECK ("contentHash" ~ '^[0-9a-f]{64}$'),
 CONSTRAINT "ResumeSummary_parserVersion" CHECK ("parserVersion" BETWEEN 1 AND 10000),
 CONSTRAINT "ResumeSummary_confidence" CHECK ("confidence" >= 0 AND "confidence" <= 1),
 CONSTRAINT "ResumeSummary_summary_bounded" CHECK (jsonb_typeof("summary") = 'object' AND octet_length("summary"::text) <= 32768)
);
CREATE UNIQUE INDEX "ResumeSummary_userId_contentHash_parserVersion_key" ON "ResumeSummary"("userId", "contentHash", "parserVersion");
ALTER TABLE "ResumeSummary" ADD CONSTRAINT "ResumeSummary_userId_fkey"
 FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResumeSummary" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ResumeSummary" FROM PUBLIC;
DO $runtime$
DECLARE r text;
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
  EXECUTE format('REVOKE ALL ON "ResumeSummary" FROM %I',r);
 END IF; END LOOP;
 -- Only the existing bounded server role, with explicit row policies (see 20261103200000).
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN
  GRANT SELECT,INSERT,DELETE ON "ResumeSummary" TO outclass_production_app;
  CREATE POLICY resume_summary_runtime_read ON "ResumeSummary" FOR SELECT TO outclass_production_app USING (true);
  CREATE POLICY resume_summary_runtime_insert ON "ResumeSummary" FOR INSERT TO outclass_production_app WITH CHECK (true);
  CREATE POLICY resume_summary_runtime_delete ON "ResumeSummary" FOR DELETE TO outclass_production_app USING (true);
 END IF;
END $runtime$;
COMMIT;
