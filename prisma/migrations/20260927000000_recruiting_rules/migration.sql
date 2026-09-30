BEGIN;
CREATE TABLE "RecruitingRule" (
  "roundId" TEXT PRIMARY KEY REFERENCES "PipelineRound"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "minGpa" DOUBLE PRECISION, "minSat" INTEGER, "minAct" INTEGER,
  "revision" INTEGER NOT NULL DEFAULT 1, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitingRule_thresholds_check" CHECK (
    ("minGpa" IS NULL OR "minGpa" BETWEEN 0 AND 4) AND
    ("minSat" IS NULL OR ("minSat" BETWEEN 400 AND 1600 AND "minSat" % 10 = 0)) AND
    ("minAct" IS NULL OR "minAct" BETWEEN 1 AND 36) AND "revision" > 0)
);
CREATE TABLE "RecruitingRuleFlag" (
  "roundId" TEXT NOT NULL REFERENCES "RecruitingRule"("roundId") ON DELETE CASCADE ON UPDATE CASCADE,
  "applicationId" TEXT NOT NULL REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "ruleRevision" INTEGER NOT NULL CHECK ("ruleRevision" > 0), "reasons" TEXT[] NOT NULL,
  "flaggedBy" TEXT NOT NULL, "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("roundId", "applicationId")
);
ALTER TABLE "RecruitingRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RecruitingRuleFlag" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "RecruitingRule", "RecruitingRuleFlag" FROM PUBLIC;
DO $$ DECLARE api_role text; BEGIN
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
 EXECUTE format('REVOKE ALL ON "RecruitingRule", "RecruitingRuleFlag" FROM %I',api_role);
 END IF;
 END LOOP;
END $$;
COMMIT;
