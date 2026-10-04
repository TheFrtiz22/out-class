BEGIN;
ALTER TABLE "VotingSession" ADD COLUMN "displayConfig" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "joinOpenedAt" TIMESTAMP(3), ADD COLUMN "activeApplicationId" TEXT;
ALTER TABLE "VotingParticipant" ADD COLUMN "joinedAt" TIMESTAMP(3);
-- Earlier sessions did not store display history. Preserve their current round configuration once.
-- An empty round object used the canonical default fields before session snapshots existed.
UPDATE "VotingSession" s SET "displayConfig" = CASE WHEN r."applicantDisplay" ? 'fields'
  THEN r."applicantDisplay" ELSE '{"version":1,"fields":["name","photo","major","graduationYear","gpa","sat","act","experiences","answers","applicationContext","pros","cons","score","feedback","resume","linkedin"]}'::jsonb END,
  "joinOpenedAt" = s."startedAt"
FROM "PipelineRound" r WHERE r.id = s."roundId";
UPDATE "VotingSession" s SET "activeApplicationId" = (
  SELECT c."applicationId" FROM "VotingPassCandidate" c
  WHERE c."sessionId"=s.id AND c."passNumber"=s."currentPass" ORDER BY c.position LIMIT 1
) WHERE s.state IN ('OPEN','PAUSED');
ALTER TABLE "VotingSession" ADD CONSTRAINT "VotingSession_displayConfig_object" CHECK (jsonb_typeof("displayConfig") = 'object');
-- Candidate selection is validated against the current pass by the transactional engine.
CREATE FUNCTION voting_display_snapshot_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD."startedAt" IS NOT NULL OR OLD."joinOpenedAt" IS NOT NULL) AND NEW."displayConfig" IS DISTINCT FROM OLD."displayConfig" THEN
    RAISE EXCEPTION 'Voting display snapshot is locked';
  END IF;
  IF NEW."activeApplicationId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "VotingPassCandidate" c WHERE c."sessionId"=NEW.id AND c."passNumber"=NEW."currentPass" AND c."applicationId"=NEW."activeApplicationId"
  ) THEN RAISE EXCEPTION 'Active candidate must belong to the current pass'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER voting_display_snapshot_locked BEFORE UPDATE ON "VotingSession" FOR EACH ROW EXECUTE FUNCTION voting_display_snapshot_guard();
COMMIT;
