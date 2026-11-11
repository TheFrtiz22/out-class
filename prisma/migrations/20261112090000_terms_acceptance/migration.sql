-- Clickwrap acceptance of the Terms of Service and Privacy Policy (lib/legal-versions.ts).
-- Additive only: no existing table, trigger, grant or row changes; no backfill (users without a
-- row are asked once, in the app). Server-only like CalendarFeedToken: RLS on, no browser-role
-- access, and the bounded runtime role may only read and append. Rows are evidence: no UPDATE or
-- DELETE grant. The ON DELETE CASCADE from "User" runs as the table owner, so account deletion
-- removes these rows without a runtime DELETE grant.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE "TermsAcceptance" (
 "id" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "termsVersion" TEXT NOT NULL,
 "privacyVersion" TEXT NOT NULL,
 "source" TEXT NOT NULL,
 "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "TermsAcceptance_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "TermsAcceptance_source" CHECK ("source" IN ('SIGNUP','CLAIM','PROMPT')),
 CONSTRAINT "TermsAcceptance_versions_bounded" CHECK (length("termsVersion") BETWEEN 1 AND 40 AND length("privacyVersion") BETWEEN 1 AND 40)
);
CREATE UNIQUE INDEX "TermsAcceptance_userId_termsVersion_privacyVersion_key" ON "TermsAcceptance"("userId", "termsVersion", "privacyVersion");
ALTER TABLE "TermsAcceptance" ADD CONSTRAINT "TermsAcceptance_userId_fkey"
 FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TermsAcceptance" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "TermsAcceptance" FROM PUBLIC;
DO $runtime$
DECLARE r text;
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
  EXECUTE format('REVOKE ALL ON "TermsAcceptance" FROM %I',r);
 END IF; END LOOP;
 -- Only the existing bounded server role, with explicit row policies (see 20261103200000).
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN
  GRANT SELECT,INSERT ON "TermsAcceptance" TO outclass_production_app;
  CREATE POLICY terms_acceptance_runtime_read ON "TermsAcceptance" FOR SELECT TO outclass_production_app USING (true);
  CREATE POLICY terms_acceptance_runtime_insert ON "TermsAcceptance" FOR INSERT TO outclass_production_app WITH CHECK (true);
 END IF;
END $runtime$;
COMMIT;
