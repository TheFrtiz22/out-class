BEGIN;
SET LOCAL lock_timeout = '5s';
-- Applicant review grading categories and staged (unsent) decisions.
-- Additive only: two nullable JSONB columns and one new table. No existing row,
-- trigger, grant or constraint changes; NULL keeps today's single 1-10 score.
ALTER TABLE "Club" ADD COLUMN "reviewRubric" JSONB,
 ADD CONSTRAINT "Club_reviewRubric_object" CHECK (
  "reviewRubric" IS NULL OR jsonb_typeof("reviewRubric") = 'object'
 );
ALTER TABLE "Evaluation" ADD COLUMN "rubricScores" JSONB,
 ADD CONSTRAINT "Evaluation_rubricScores_object" CHECK (
  "rubricScores" IS NULL OR jsonb_typeof("rubricScores") = 'object'
 );

CREATE TABLE "StagedDecision" (
 "id" TEXT NOT NULL,
 "clubId" TEXT NOT NULL,
 "applicationId" TEXT NOT NULL,
 "outcome" TEXT NOT NULL,
 "targetStatus" "AppStatus" NOT NULL,
 "targetRoundId" TEXT,
 "expectedStatus" "AppStatus" NOT NULL,
 "expectedRoundId" TEXT NOT NULL,
 "stagedById" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "StagedDecision_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "StagedDecision_outcome_known" CHECK ("outcome" IN ('ADVANCE','HOLD','REJECT','WAITLIST','ACCEPT','ROUND')),
 CONSTRAINT "StagedDecision_target_consistent" CHECK ("targetRoundId" IS NULL OR "targetStatus" IN ('IN_REVIEW','INTERVIEWING'))
);
CREATE UNIQUE INDEX "StagedDecision_applicationId_key" ON "StagedDecision"("applicationId");
CREATE UNIQUE INDEX "StagedDecision_applicationId_clubId_key" ON "StagedDecision"("applicationId", "clubId");
CREATE INDEX "StagedDecision_clubId_idx" ON "StagedDecision"("clubId");
ALTER TABLE "StagedDecision" ADD CONSTRAINT "StagedDecision_applicationId_clubId_fkey"
 FOREIGN KEY ("applicationId", "clubId") REFERENCES "Application"("id", "clubId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StagedDecision" ADD CONSTRAINT "StagedDecision_stagedById_clubId_fkey"
 FOREIGN KEY ("stagedById", "clubId") REFERENCES "ClubMember"("id", "clubId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StagedDecision" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "StagedDecision" FROM PUBLIC;
DO $runtime$
DECLARE r text;
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
  EXECUTE format('REVOKE ALL ON "StagedDecision" FROM %I',r);
 END IF; END LOOP;
 -- Only the existing bounded server role, with explicit row policies (see 20261103200000).
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN
  GRANT SELECT,INSERT,UPDATE,DELETE ON "StagedDecision" TO outclass_production_app;
  CREATE POLICY staged_decision_runtime_read ON "StagedDecision" FOR SELECT TO outclass_production_app USING (true);
  CREATE POLICY staged_decision_runtime_insert ON "StagedDecision" FOR INSERT TO outclass_production_app WITH CHECK (true);
  CREATE POLICY staged_decision_runtime_update ON "StagedDecision" FOR UPDATE TO outclass_production_app USING (true) WITH CHECK (true);
  CREATE POLICY staged_decision_runtime_delete ON "StagedDecision" FOR DELETE TO outclass_production_app USING (true);
 END IF;
END $runtime$;
COMMIT;
