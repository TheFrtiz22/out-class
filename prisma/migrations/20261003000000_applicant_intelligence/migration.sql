BEGIN;
ALTER TABLE "PipelineRound" ADD COLUMN "applicantDisplay" JSONB NOT NULL DEFAULT '{}', ADD COLUMN "displayVersion" INTEGER NOT NULL DEFAULT 0;
-- Preserve legacy scores; validate new/updated evaluations without rewriting historical values.
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_score_range_check" CHECK (score >= 1 AND score <= 10) NOT VALID;
ALTER TABLE "InterviewRecord" ADD COLUMN "evaluationId" TEXT;
ALTER TABLE "InterviewRecord" ADD CONSTRAINT "InterviewRecord_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"(id) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "InterviewRecord_evaluationId_idx" ON "InterviewRecord"("evaluationId");
-- Link only unambiguous historical matches. Never overwrite either historical source.
UPDATE "InterviewRecord" r SET "evaluationId" = e.id
FROM "Evaluation" e, "PipelineRound" p
WHERE r."completedAt" IS NOT NULL AND p.id = r."roundId"
AND e."applicationId" = r."applicationId" AND e."interviewerId" = r."interviewerId" AND e.round = p.name
AND (SELECT count(*) FROM "PipelineRound" candidate WHERE candidate."clubId" = p."clubId" AND candidate.name = p.name) = 1;
CREATE TABLE "ApplicantObservation" (
  id TEXT NOT NULL PRIMARY KEY,
  "applicationId" TEXT NOT NULL REFERENCES "Application"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "authorId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('PRO', 'CON')),
  body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 3000),
  "anonymousReview" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "ApplicantObservation_applicationId_createdAt_idx" ON "ApplicantObservation"("applicationId", "createdAt");
CREATE INDEX "ApplicantObservation_authorId_idx" ON "ApplicantObservation"("authorId");
ALTER TABLE "ApplicantObservation" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ApplicantObservation" FROM PUBLIC;
DO $$ DECLARE api_role text; BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
      EXECUTE format('REVOKE ALL ON "ApplicantObservation" FROM %I', api_role);
    END IF;
  END LOOP;
END $$;
COMMIT;
