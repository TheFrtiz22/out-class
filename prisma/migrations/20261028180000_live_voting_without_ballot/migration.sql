BEGIN;
ALTER TABLE "VotingPassCandidate" ADD COLUMN "withoutVote" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VotingPassCandidate" DROP CONSTRAINT "VotingPassCandidate_live_state";
ALTER TABLE "VotingPassCandidate" ADD CONSTRAINT "VotingPassCandidate_live_state" CHECK (
 (NOT "withoutVote" AND (
  ("ballotState"='PENDING' AND "openedAt" IS NULL AND "closedAt" IS NULL AND "confirmedDecision" IS NULL AND "confirmedBy" IS NULL AND "confirmedAt" IS NULL) OR
  ("ballotState"='OPEN' AND "openedAt" IS NOT NULL AND "closedAt" IS NULL AND "confirmedDecision" IS NULL AND "confirmedBy" IS NULL AND "confirmedAt" IS NULL) OR
  ("ballotState"='CLOSED' AND "openedAt" IS NOT NULL AND "closedAt" IS NOT NULL AND "closedAt">="openedAt" AND "confirmedDecision" IS NULL AND "confirmedBy" IS NULL AND "confirmedAt" IS NULL) OR
  ("ballotState"='CONFIRMED' AND "openedAt" IS NOT NULL AND "closedAt" IS NOT NULL AND "closedAt">="openedAt" AND "confirmedDecision" IN ('PASS','HOLD','NOT_PASS') AND "confirmedDecision" IS NOT NULL AND "confirmedBy" IS NOT NULL AND "confirmedAt">="closedAt" AND "confirmedAt" IS NOT NULL))) OR
 ("withoutVote" AND "ballotState"='CONFIRMED' AND "openedAt" IS NULL AND "closedAt" IS NULL AND "confirmedDecision" IN ('PASS','HOLD') AND "confirmedDecision" IS NOT NULL AND "confirmedBy" IS NOT NULL AND "confirmedAt" IS NOT NULL)
);
CREATE OR REPLACE FUNCTION outclass_live_voting_entry_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s "VotingSession";
BEGIN
 SELECT * INTO s FROM "VotingSession" WHERE id=OLD."sessionId" FOR UPDATE;
 IF TG_OP='DELETE' THEN
  IF s.mode='LIVE' THEN RAISE EXCEPTION 'Voting history is protected'; END IF;
  RETURN OLD;
 END IF;
 IF s.mode='LIVE' THEN
  IF s."finalizedAt" IS NOT NULL OR (NEW."sessionId",NEW."passNumber",NEW."applicationId",NEW.position) IS DISTINCT FROM (OLD."sessionId",OLD."passNumber",OLD."applicationId",OLD.position) THEN RAISE EXCEPTION 'Voting history is protected'; END IF;
  IF OLD."ballotState"='PENDING' AND NEW."ballotState"='CONFIRMED' AND NEW."withoutVote" AND NEW."confirmedDecision"='PASS' AND s.state='OPEN' AND s."currentPass"=OLD."passNumber" AND s."activeApplicationId"=OLD."applicationId" AND NOT EXISTS(SELECT 1 FROM "VotingBallot" WHERE "sessionId"=OLD."sessionId" AND "passNumber"=OLD."passNumber" AND "applicationId"=OLD."applicationId") THEN RETURN NEW; END IF;
  IF NEW."withoutVote"<>OLD."withoutVote" OR NOT ((OLD."ballotState"='PENDING' AND NEW."ballotState"='OPEN') OR (OLD."ballotState"='OPEN' AND NEW."ballotState"='CLOSED') OR (OLD."ballotState"='CLOSED' AND NEW."ballotState"='CONFIRMED') OR (OLD."ballotState"='CONFIRMED' AND NEW."ballotState"='CONFIRMED')) THEN RAISE EXCEPTION 'Invalid ballot transition'; END IF;
 END IF;
 IF s.mode<>'LIVE' AND NEW."withoutVote" THEN RAISE EXCEPTION 'Only LIVE rooms accept without ballots'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION outclass_no_direct_without_vote() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."withoutVote" THEN RAISE EXCEPTION 'Accept without vote must confirm a pending instance'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "VotingPassCandidate_without_vote_insert" BEFORE INSERT ON "VotingPassCandidate" FOR EACH ROW EXECUTE FUNCTION outclass_no_direct_without_vote();
-- Only this transaction's ended LIVE room may defer its own candidate updates.
-- Normal CRM/invitation notification behavior remains unchanged.
CREATE OR REPLACE FUNCTION outclass_application_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='UPDATE' AND EXISTS (
  SELECT 1 FROM "VotingSession" s JOIN "VotingCandidate" c ON c."sessionId"=s.id
  WHERE s.id=current_setting('outclass.voting_finalization',true) AND s.mode='LIVE' AND s.state='COMPLETED' AND s."finalizedAt" IS NULL
   AND s."clubId"=OLD."clubId" AND s."roundId"=OLD."roundId" AND s."cycleId"=OLD."recruitmentCycleId" AND c."applicationId"=OLD.id
 ) THEN RETURN NEW; END IF;
 IF NEW.status IN ('ACCEPTED','WAITLISTED','REJECTED') AND NEW."decisionVersion">0 THEN RETURN NEW; END IF;
 IF NEW.status='DRAFTING' OR NEW."submittedAt" IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW.status=OLD.status AND NEW."roundId"=OLD."roundId" THEN RETURN NEW; END IF;
 PERFORM outclass_notify(NEW."studentId",NEW."clubId",'application:'||NEW.id||':'||gen_random_uuid()::text,
 CASE WHEN NEW.status='INTERVIEWING' THEN 'INTERVIEW' ELSE 'APPLICATION' END,
 CASE WHEN NEW.status='INTERVIEWING' THEN 'You have an interview invitation' ELSE 'Application update' END,
 'Your application status is '||replace(lower(NEW.status::text),'_',' ')||'. Open your application for the latest details.',
 '/?workspace=student&view=tracker');
 RETURN NEW;
END $$;
COMMIT;
