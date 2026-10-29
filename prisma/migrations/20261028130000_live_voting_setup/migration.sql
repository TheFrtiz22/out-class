BEGIN;
ALTER TABLE "VotingSession" ADD COLUMN "targetUnset" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "presentationOptions" JSONB NOT NULL DEFAULT '{}',
 ADD CONSTRAINT "VotingSession_optional_target" CHECK (NOT "targetUnset" OR (mode='LIVE' AND "targetSize"=1)),
 ADD CONSTRAINT "VotingSession_presentation_options" CHECK (jsonb_typeof("presentationOptions")='object');
CREATE FUNCTION outclass_live_presentation_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.mode='LIVE' AND (OLD."startedAt" IS NOT NULL OR OLD."joinOpenedAt" IS NOT NULL) AND
   (NEW."presentationOptions",NEW."targetUnset") IS DISTINCT FROM (OLD."presentationOptions",OLD."targetUnset") THEN
  RAISE EXCEPTION 'Live presentation setup is locked';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "VotingSession_live_presentation_snapshot" BEFORE UPDATE ON "VotingSession" FOR EACH ROW EXECUTE FUNCTION outclass_live_presentation_snapshot();
-- Late check-in changes presence only, never eligibility or the historical denominator.
CREATE OR REPLACE FUNCTION outclass_live_voting_roster_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s "VotingSession";
BEGIN
 IF TG_OP='DELETE' THEN
  SELECT * INTO s FROM "VotingSession" WHERE id=OLD."sessionId" FOR UPDATE;
  IF s.mode='LIVE' THEN RAISE EXCEPTION 'Live voting roster is frozen'; END IF;
  RETURN OLD;
 END IF;
 SELECT * INTO s FROM "VotingSession" WHERE id=NEW."sessionId" FOR UPDATE;
 IF s.mode='LIVE' THEN
  IF s.state='COMPLETED' OR s."finalizedAt" IS NOT NULL THEN RAISE EXCEPTION 'Live voting roster is frozen'; END IF;
  IF TG_OP='UPDATE' THEN
   IF (NEW."sessionId",NEW."memberId") IS DISTINCT FROM (OLD."sessionId",OLD."memberId") THEN RAISE EXCEPTION 'Live voting roster is frozen'; END IF;
  ELSIF s."startedAt" IS NOT NULL THEN RAISE EXCEPTION 'Live voting roster is frozen'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "ClubMember" m WHERE m.id=NEW."memberId" AND m."clubId"=s."clubId") THEN RAISE EXCEPTION 'Live voting roster scope mismatch'; END IF;
 END IF;
 RETURN NEW;
END $$;
COMMIT;
