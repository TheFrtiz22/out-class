BEGIN;
ALTER TABLE "PipelineRound" ADD COLUMN "interviewKit" JSONB NOT NULL DEFAULT '[]', ADD COLUMN "kitVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "InterviewRecord" (
 "id" TEXT NOT NULL PRIMARY KEY, "applicationId" TEXT NOT NULL, "interviewerId" TEXT NOT NULL, "roundId" TEXT NOT NULL,
 "questions" JSONB NOT NULL, "draft" JSONB NOT NULL, "anonymousReview" BOOLEAN NOT NULL,
 "revision" INTEGER NOT NULL DEFAULT 0, "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "InterviewRecord_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "InterviewRecord_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "ClubMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "InterviewRecord_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "PipelineRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InterviewRecord_applicationId_interviewerId_roundId_key" ON "InterviewRecord"("applicationId","interviewerId","roundId");
ALTER TABLE "InterviewRecord" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "InterviewRecord" FROM PUBLIC;
DO $$ DECLARE api_role text; BEGIN
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN EXECUTE format('REVOKE ALL ON "InterviewRecord" FROM %I',api_role); END IF;
 END LOOP;
END $$;
-- Preserve legacy orphan slots while enforcing the existing schema relation for new writes.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InterviewSlot_clubId_fkey' AND conrelid = '"InterviewSlot"'::regclass) THEN
 ALTER TABLE "InterviewSlot" ADD CONSTRAINT "InterviewSlot_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
 END IF;
END $$;
COMMIT;
