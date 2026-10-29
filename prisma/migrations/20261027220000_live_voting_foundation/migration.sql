-- Additive, opt-in LIVE semantics. Historical sessions/ballots remain LEGACY.
BEGIN;
ALTER TABLE "VotingSession"
 ADD COLUMN mode TEXT NOT NULL DEFAULT 'LEGACY',
 ADD COLUMN "cycleId" TEXT,
 ADD COLUMN "leaderMemberIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 ADD COLUMN "finalizedAt" TIMESTAMP(3),
 ADD CONSTRAINT "VotingSession_cycle_scope" FOREIGN KEY ("cycleId","clubId") REFERENCES "RecruitmentCycle"(id,"clubId") ON DELETE RESTRICT ON UPDATE NO ACTION,
 ADD CONSTRAINT "VotingSession_live_contract" CHECK (mode IN ('LEGACY','LIVE') AND (mode='LEGACY' OR ("cycleId" IS NOT NULL AND cardinality("leaderMemberIds") BETWEEN 1 AND 50 AND "autoAdvance"='NONE'))),
 ADD CONSTRAINT "VotingSession_finalized_closed" CHECK ("finalizedAt" IS NULL OR (mode='LIVE' AND state='COMPLETED'));
ALTER TABLE "VotingPassCandidate"
 ADD COLUMN "ballotState" TEXT NOT NULL DEFAULT 'PENDING',
 ADD COLUMN "openedAt" TIMESTAMP(3), ADD COLUMN "closedAt" TIMESTAMP(3),
 ADD COLUMN "confirmedDecision" TEXT, ADD COLUMN "confirmedBy" TEXT REFERENCES "User"(id) ON DELETE RESTRICT,
 ADD COLUMN "confirmedAt" TIMESTAMP(3),
 ADD CONSTRAINT "VotingPassCandidate_live_state" CHECK (
   ("ballotState"='PENDING' AND "openedAt" IS NULL AND "closedAt" IS NULL AND "confirmedDecision" IS NULL AND "confirmedBy" IS NULL AND "confirmedAt" IS NULL) OR
   ("ballotState"='OPEN' AND "openedAt" IS NOT NULL AND "closedAt" IS NULL AND "confirmedDecision" IS NULL AND "confirmedBy" IS NULL AND "confirmedAt" IS NULL) OR
   ("ballotState"='CLOSED' AND "openedAt" IS NOT NULL AND "closedAt" IS NOT NULL AND "closedAt">="openedAt" AND "confirmedDecision" IS NULL AND "confirmedBy" IS NULL AND "confirmedAt" IS NULL) OR
   ("ballotState"='CONFIRMED' AND "openedAt" IS NOT NULL AND "closedAt" IS NOT NULL AND "closedAt">="openedAt" AND "confirmedDecision" IS NOT NULL AND "confirmedDecision" IN ('PASS','HOLD','NOT_PASS') AND "confirmedBy" IS NOT NULL AND "confirmedAt" IS NOT NULL AND "confirmedAt">="closedAt")
 );
ALTER TABLE "VotingBallot" ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK (revision>=0), ADD COLUMN "updatedAt" TIMESTAMP(3);
CREATE TABLE "VotingRoomCommand" (
 "sessionId" TEXT NOT NULL REFERENCES "VotingSession"(id) ON DELETE RESTRICT,
 "requestId" TEXT NOT NULL, "actorId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
 fingerprint TEXT NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
 result JSONB NOT NULL CHECK (jsonb_typeof(result)='object'),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("sessionId","requestId")
);
ALTER TABLE "VotingRoomCommand" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "VotingRoomCommand" FROM PUBLIC, anon, authenticated;
CREATE POLICY voting_room_commands_server_only ON "VotingRoomCommand" AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

CREATE FUNCTION outclass_live_voting_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.mode<>OLD.mode OR (OLD.mode='LIVE' AND (NEW."clubId",NEW."roundId",NEW."cycleId",NEW."leaderMemberIds") IS DISTINCT FROM (OLD."clubId",OLD."roundId",OLD."cycleId",OLD."leaderMemberIds")) THEN
   RAISE EXCEPTION 'Voting session scope and mode are immutable';
  END IF;
  IF OLD.mode='LIVE' AND OLD."finalizedAt" IS NOT NULL THEN RAISE EXCEPTION 'Finalized voting room is immutable'; END IF;
 END IF;
 IF NEW.mode='LIVE' AND (NOT EXISTS (SELECT 1 FROM "PipelineRound" WHERE id=NEW."roundId" AND "clubId"=NEW."clubId") OR
   EXISTS (SELECT 1 FROM unnest(NEW."leaderMemberIds") AS leader(id) WHERE NOT EXISTS (SELECT 1 FROM "ClubMember" m WHERE m.id=leader.id AND m."clubId"=NEW."clubId"))) THEN
  RAISE EXCEPTION 'Voting room scope mismatch';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "VotingSession_live_scope" BEFORE INSERT OR UPDATE ON "VotingSession" FOR EACH ROW EXECUTE FUNCTION outclass_live_voting_scope();

CREATE FUNCTION outclass_live_voting_candidate_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s "VotingSession";
BEGIN
 SELECT * INTO s FROM "VotingSession" WHERE id=NEW."sessionId" FOR UPDATE;
 IF s.mode='LIVE' AND (s."startedAt" IS NOT NULL OR NOT EXISTS (SELECT 1 FROM "Application" a WHERE a.id=NEW."applicationId" AND a."clubId"=s."clubId" AND a."roundId"=s."roundId" AND a."recruitmentCycleId"=s."cycleId")) THEN
  RAISE EXCEPTION 'Live voting candidate scope is frozen';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "VotingCandidate_live_scope" BEFORE INSERT ON "VotingCandidate" FOR EACH ROW EXECUTE FUNCTION outclass_live_voting_candidate_scope();

CREATE FUNCTION outclass_live_voting_entry_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s "VotingSession";
BEGIN
 SELECT * INTO s FROM "VotingSession" WHERE id=OLD."sessionId" FOR UPDATE;
 IF TG_OP='DELETE' THEN
  IF s.mode='LIVE' THEN RAISE EXCEPTION 'Voting history is protected'; END IF;
  RETURN OLD;
 END IF;
 IF s.mode='LIVE' THEN
  IF s."finalizedAt" IS NOT NULL OR (NEW."sessionId",NEW."passNumber",NEW."applicationId",NEW.position) IS DISTINCT FROM (OLD."sessionId",OLD."passNumber",OLD."applicationId",OLD.position) THEN RAISE EXCEPTION 'Voting history is protected'; END IF;
  IF NOT ((OLD."ballotState"='PENDING' AND NEW."ballotState"='OPEN') OR (OLD."ballotState"='OPEN' AND NEW."ballotState"='CLOSED') OR (OLD."ballotState"='CLOSED' AND NEW."ballotState"='CONFIRMED') OR (OLD."ballotState"='CONFIRMED' AND NEW."ballotState"='CONFIRMED')) THEN RAISE EXCEPTION 'Invalid ballot transition'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "VotingPassCandidate_live_guard" BEFORE UPDATE OR DELETE ON "VotingPassCandidate" FOR EACH ROW EXECUTE FUNCTION outclass_live_voting_entry_guard();

CREATE FUNCTION outclass_live_voting_roster_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s "VotingSession";
BEGIN
 IF TG_OP='DELETE' THEN
  SELECT * INTO s FROM "VotingSession" WHERE id=OLD."sessionId" FOR UPDATE;
  IF s.mode='LIVE' THEN RAISE EXCEPTION 'Live voting roster is frozen'; END IF;
  RETURN OLD;
 END IF;
 SELECT * INTO s FROM "VotingSession" WHERE id=NEW."sessionId" FOR UPDATE;
 IF s.mode='LIVE' AND (s."startedAt" IS NOT NULL OR NOT EXISTS (SELECT 1 FROM "ClubMember" m WHERE m.id=NEW."memberId" AND m."clubId"=s."clubId")) THEN RAISE EXCEPTION 'Live voting roster is frozen or out of scope'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "VotingParticipant_live_scope" BEFORE INSERT OR UPDATE OR DELETE ON "VotingParticipant" FOR EACH ROW EXECUTE FUNCTION outclass_live_voting_roster_guard();

-- Retain the original update/delete rejection for every historical ballot.
CREATE OR REPLACE FUNCTION outclass_immutable_ballot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s "VotingSession"; c "VotingPassCandidate";
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Voting ballots cannot be deleted'; END IF;
 SELECT * INTO s FROM "VotingSession" WHERE id=OLD."sessionId" FOR UPDATE;
 IF s.mode<>'LIVE' THEN RAISE EXCEPTION 'Voting ballots are immutable'; END IF;
 SELECT * INTO c FROM "VotingPassCandidate" WHERE "sessionId"=OLD."sessionId" AND "passNumber"=OLD."passNumber" AND "applicationId"=OLD."applicationId";
 IF (NEW.id,NEW."sessionId",NEW."passNumber",NEW."applicationId",NEW."memberId",NEW."createdAt") IS DISTINCT FROM (OLD.id,OLD."sessionId",OLD."passNumber",OLD."applicationId",OLD."memberId",OLD."createdAt") OR NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Ballot identity or revision changed'; END IF;
 IF s.state<>'OPEN' OR s."finalizedAt" IS NOT NULL OR s."currentPass"<>OLD."passNumber" OR s."activeApplicationId" IS DISTINCT FROM OLD."applicationId" OR c."ballotState"<>'OPEN' THEN RAISE EXCEPTION 'Voting is closed'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION outclass_live_ballot_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s "VotingSession";
BEGIN
 SELECT * INTO s FROM "VotingSession" WHERE id=NEW."sessionId" FOR UPDATE;
 IF s.mode='LIVE' AND (s.state<>'OPEN' OR s."finalizedAt" IS NOT NULL OR s."currentPass"<>NEW."passNumber" OR s."activeApplicationId" IS DISTINCT FROM NEW."applicationId" OR NOT EXISTS
   (SELECT 1 FROM "VotingPassCandidate" c WHERE c."sessionId"=NEW."sessionId" AND c."passNumber"=NEW."passNumber" AND c."applicationId"=NEW."applicationId" AND c."ballotState"='OPEN')) THEN RAISE EXCEPTION 'Voting is closed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "VotingBallot_live_insert" BEFORE INSERT ON "VotingBallot" FOR EACH ROW EXECUTE FUNCTION outclass_live_ballot_insert();
CREATE FUNCTION outclass_voting_receipt_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Voting command receipts are immutable'; END $$;
CREATE TRIGGER "VotingRoomCommand_immutable" BEFORE UPDATE OR DELETE ON "VotingRoomCommand" FOR EACH ROW EXECUTE FUNCTION outclass_voting_receipt_immutable();
-- Match the established server-owned table policy; never grant Data API roles access.
DO $migration$
DECLARE had_create BOOLEAN;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN RETURN; END IF;
 had_create := has_schema_privilege('outclass_production_app','public','CREATE');
 IF NOT had_create THEN GRANT CREATE ON SCHEMA public TO outclass_production_app; END IF;
 ALTER TABLE "VotingRoomCommand" OWNER TO outclass_production_app;
 IF NOT had_create THEN REVOKE CREATE ON SCHEMA public FROM outclass_production_app; END IF;
END $migration$;
COMMIT;
