BEGIN;
SET LOCAL lock_timeout = '5s';
-- Conflict-of-interest recusals. Additive only: no existing table, trigger,
-- grant or row changes. A recusal ties one member to one application in the
-- same club; lifting it keeps the row (liftedAt) for the audit trail.
CREATE TABLE "ApplicantRecusal" (
 "id" TEXT NOT NULL,
 "clubId" TEXT NOT NULL,
 "applicationId" TEXT NOT NULL,
 "memberId" TEXT NOT NULL,
 "createdById" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "liftedAt" TIMESTAMP(3),
 "liftedById" TEXT,
 CONSTRAINT "ApplicantRecusal_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ApplicantRecusal_lift_consistent" CHECK (("liftedAt" IS NULL) = ("liftedById" IS NULL))
);
CREATE UNIQUE INDEX "ApplicantRecusal_applicationId_memberId_key" ON "ApplicantRecusal"("applicationId", "memberId");
CREATE INDEX "ApplicantRecusal_clubId_memberId_idx" ON "ApplicantRecusal"("clubId", "memberId");
ALTER TABLE "ApplicantRecusal" ADD CONSTRAINT "ApplicantRecusal_applicationId_clubId_fkey"
 FOREIGN KEY ("applicationId", "clubId") REFERENCES "Application"("id", "clubId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicantRecusal" ADD CONSTRAINT "ApplicantRecusal_memberId_clubId_fkey"
 FOREIGN KEY ("memberId", "clubId") REFERENCES "ClubMember"("id", "clubId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApplicantRecusal" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ApplicantRecusal" FROM PUBLIC;
DO $runtime$
DECLARE r text;
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
  EXECUTE format('REVOKE ALL ON "ApplicantRecusal" FROM %I',r);
 END IF; END LOOP;
 -- Only the existing bounded server role, with explicit row policies (see 20261103200000).
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN
  GRANT SELECT,INSERT,UPDATE ON "ApplicantRecusal" TO outclass_production_app;
  CREATE POLICY applicant_recusal_runtime_read ON "ApplicantRecusal" FOR SELECT TO outclass_production_app USING (true);
  CREATE POLICY applicant_recusal_runtime_insert ON "ApplicantRecusal" FOR INSERT TO outclass_production_app WITH CHECK (true);
  CREATE POLICY applicant_recusal_runtime_update ON "ApplicantRecusal" FOR UPDATE TO outclass_production_app USING (true) WITH CHECK (true);
 END IF;
END $runtime$;
COMMIT;
