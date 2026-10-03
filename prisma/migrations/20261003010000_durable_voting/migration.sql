BEGIN;
-- CreateTable
CREATE TABLE "VotingSession" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "targetSize" INTEGER NOT NULL,
    "autoAdvance" TEXT NOT NULL DEFAULT 'NONE',
    "threshold" INTEGER NOT NULL DEFAULT 100,
    "currentPass" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VotingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VotingParticipant" (
    "sessionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "VotingParticipant_pkey" PRIMARY KEY ("sessionId","memberId")
);

-- CreateTable
CREATE TABLE "VotingCandidate" (
    "sessionId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "expectedStatus" "AppStatus" NOT NULL,
    "publishedStatus" "AppStatus",

    CONSTRAINT "VotingCandidate_pkey" PRIMARY KEY ("sessionId","applicationId")
);

-- CreateTable
CREATE TABLE "VotingPass" (
    "sessionId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'OPEN',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "VotingPass_pkey" PRIMARY KEY ("sessionId","number")
);

-- CreateTable
CREATE TABLE "VotingPassCandidate" (
    "sessionId" TEXT NOT NULL,
    "passNumber" INTEGER NOT NULL,
    "applicationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "override" TEXT,
    "overrideBy" TEXT,
    "overrideAt" TIMESTAMP(3),

    CONSTRAINT "VotingPassCandidate_pkey" PRIMARY KEY ("sessionId","passNumber","applicationId")
);

-- CreateTable
CREATE TABLE "VotingBallot" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "passNumber" INTEGER NOT NULL,
    "applicationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VotingBallot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VotingSession_clubId_roundId_createdAt_idx" ON "VotingSession"("clubId", "roundId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VotingCandidate_sessionId_position_key" ON "VotingCandidate"("sessionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "VotingPassCandidate_sessionId_passNumber_position_key" ON "VotingPassCandidate"("sessionId", "passNumber", "position");

-- CreateIndex
CREATE UNIQUE INDEX "VotingBallot_sessionId_passNumber_applicationId_memberId_key" ON "VotingBallot"("sessionId", "passNumber", "applicationId", "memberId");

-- AddForeignKey
ALTER TABLE "VotingSession" ADD CONSTRAINT "VotingSession_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingSession" ADD CONSTRAINT "VotingSession_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "PipelineRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingParticipant" ADD CONSTRAINT "VotingParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VotingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingParticipant" ADD CONSTRAINT "VotingParticipant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "ClubMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingCandidate" ADD CONSTRAINT "VotingCandidate_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VotingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingCandidate" ADD CONSTRAINT "VotingCandidate_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingPass" ADD CONSTRAINT "VotingPass_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VotingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingPassCandidate" ADD CONSTRAINT "VotingPassCandidate_sessionId_passNumber_fkey" FOREIGN KEY ("sessionId", "passNumber") REFERENCES "VotingPass"("sessionId", "number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingPassCandidate" ADD CONSTRAINT "VotingPassCandidate_sessionId_applicationId_fkey" FOREIGN KEY ("sessionId", "applicationId") REFERENCES "VotingCandidate"("sessionId", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingBallot" ADD CONSTRAINT "VotingBallot_sessionId_passNumber_applicationId_fkey" FOREIGN KEY ("sessionId", "passNumber", "applicationId") REFERENCES "VotingPassCandidate"("sessionId", "passNumber", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingBallot" ADD CONSTRAINT "VotingBallot_sessionId_memberId_fkey" FOREIGN KEY ("sessionId", "memberId") REFERENCES "VotingParticipant"("sessionId", "memberId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Validate configuration and lifecycle at the database boundary.
ALTER TABLE "VotingSession" ADD CHECK (state IN ('DRAFT','OPEN','PAUSED','COMPLETED')), ADD CHECK ("targetSize" BETWEEN 1 AND 2000), ADD CHECK ("autoAdvance" IN ('NONE','UNANIMOUS','THRESHOLD')), ADD CHECK (threshold BETWEEN 51 AND 100), ADD CHECK ("currentPass" >= 0), ADD CHECK (revision >= 0);
ALTER TABLE "VotingPass" ADD CHECK (state IN ('OPEN','COMPLETED')), ADD CHECK (number > 0);
ALTER TABLE "VotingPassCandidate" ADD CHECK ("override" IS NULL OR "override" IN ('PASS','HOLD','NOT_PASS'));
ALTER TABLE "VotingBallot" ADD CHECK (decision IN ('PASS','HOLD','NOT_PASS'));
CREATE FUNCTION outclass_immutable_ballot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Voting ballots are immutable'; END $$;
CREATE TRIGGER "VotingBallot_immutable" BEFORE UPDATE OR DELETE ON "VotingBallot" FOR EACH ROW EXECUTE FUNCTION outclass_immutable_ballot();
-- Server-only tables: authenticated browsers cannot bypass action authorization.
DO $$ DECLARE tbl text; api_role text; BEGIN
  FOREACH tbl IN ARRAY ARRAY['VotingSession','VotingParticipant','VotingCandidate','VotingPass','VotingPassCandidate','VotingBallot'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',tbl);
    FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN EXECUTE format('REVOKE ALL ON %I FROM %I',tbl,api_role); END IF;
    END LOOP;
  END LOOP;
END $$;

COMMIT;
