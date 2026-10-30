-- Preserve closed ballot history; permit only audited, revision-bound last-decision Undo.
BEGIN;
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
  IF OLD."ballotState"='CONFIRMED' AND NEW."ballotState"=(CASE WHEN OLD."withoutVote" THEN 'PENDING' ELSE 'CLOSED' END)
   AND NOT NEW."withoutVote" AND NEW."confirmedDecision" IS NULL AND NEW."confirmedBy" IS NULL AND NEW."confirmedAt" IS NULL
   AND (NEW."openedAt",NEW."closedAt") IS NOT DISTINCT FROM (OLD."openedAt",OLD."closedAt")
   AND s.state IN ('OPEN','PAUSED') AND s."currentPass"=OLD."passNumber"
   AND EXISTS(SELECT 1 FROM "AuditLog" a WHERE a."targetId"=s.id AND a."clubId"=s."clubId" AND a.action='voting.room.undo_authorized'
    AND a.details->>'requestId'=current_setting('outclass.voting_undo',true) AND a.details->>'applicationId'=OLD."applicationId"
    AND (a.details->>'passNumber')::integer=s."currentPass" AND (a.details->>'revision')::integer=s.revision)
   AND NOT EXISTS(SELECT 1 FROM "VotingPassCandidate" c WHERE c."sessionId"=s.id AND c."passNumber"=s."currentPass" AND c.position>OLD.position AND (c."ballotState"<>'PENDING' OR EXISTS(SELECT 1 FROM "VotingBallot" v WHERE v."sessionId"=c."sessionId" AND v."passNumber"=c."passNumber" AND v."applicationId"=c."applicationId")))
  THEN RETURN NEW; END IF;
  IF OLD."ballotState"='PENDING' AND NEW."ballotState"='CONFIRMED' AND NEW."withoutVote" AND NEW."confirmedDecision"='PASS' AND s.state='OPEN' AND s."currentPass"=OLD."passNumber" AND s."activeApplicationId"=OLD."applicationId" AND NOT EXISTS(SELECT 1 FROM "VotingBallot" WHERE "sessionId"=OLD."sessionId" AND "passNumber"=OLD."passNumber" AND "applicationId"=OLD."applicationId") THEN RETURN NEW; END IF;
  IF NEW."withoutVote"<>OLD."withoutVote" OR NOT ((OLD."ballotState"='PENDING' AND NEW."ballotState"='OPEN') OR (OLD."ballotState"='OPEN' AND NEW."ballotState"='CLOSED') OR (OLD."ballotState"='CLOSED' AND NEW."ballotState"='CONFIRMED') OR (OLD."ballotState"='CONFIRMED' AND NEW."ballotState"='CONFIRMED')) THEN RAISE EXCEPTION 'Invalid ballot transition'; END IF;
 END IF;
 IF s.mode<>'LIVE' AND NEW."withoutVote" THEN RAISE EXCEPTION 'Only LIVE rooms accept without ballots'; END IF;
 RETURN NEW;
END $$;
COMMIT;
