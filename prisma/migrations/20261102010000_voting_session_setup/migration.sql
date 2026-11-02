-- Extend the existing session JSON and guards. No tables, columns or historical rewrites.
-- Unstarted roster replacement is permitted only in an explicitly scoped transaction.
BEGIN;
CREATE OR REPLACE FUNCTION outclass_live_voting_roster_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s "VotingSession";
BEGIN
 IF TG_OP='DELETE' THEN
  SELECT * INTO s FROM "VotingSession" WHERE id=OLD."sessionId" FOR UPDATE;
  IF s.mode='LIVE' AND NOT (s.state='DRAFT' AND s."startedAt" IS NULL AND s."joinOpenedAt" IS NULL AND NOT EXISTS(SELECT 1 FROM "VotingPass" WHERE "sessionId"=s.id) AND current_setting('outclass.voting_setup_edit',true) IS NOT DISTINCT FROM 'confirmed') THEN RAISE EXCEPTION 'Live voting roster is frozen'; END IF;
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

CREATE FUNCTION outclass_voting_candidate_setup_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s "VotingSession";
BEGIN
 SELECT * INTO s FROM "VotingSession" WHERE id=OLD."sessionId" FOR UPDATE;
 IF s.mode='LIVE' AND NOT (s.state='DRAFT' AND s."startedAt" IS NULL AND s."joinOpenedAt" IS NULL AND current_setting('outclass.voting_setup_edit',true) IS NOT DISTINCT FROM 'confirmed' AND NOT EXISTS(SELECT 1 FROM "VotingPass" WHERE "sessionId"=s.id)) THEN RAISE EXCEPTION 'Live voting roster is frozen'; END IF;
 IF TG_OP='UPDATE' THEN
  IF s.mode='LIVE' THEN RAISE EXCEPTION 'Replace the unstarted candidate selection explicitly'; END IF;
  RETURN NEW;
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER "VotingCandidate_setup_guard" BEFORE UPDATE OR DELETE ON "VotingCandidate" FOR EACH ROW EXECUTE FUNCTION outclass_voting_candidate_setup_guard();
CREATE FUNCTION outclass_voting_meeting_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.mode='LIVE' AND NEW."presentationOptions" ? 'meeting' THEN
  IF jsonb_typeof(NEW."presentationOptions"->'meeting') IS DISTINCT FROM 'object' OR COALESCE(NEW."presentationOptions"->'meeting'->>'status','') NOT IN ('READY','SCHEDULED','CANCELLED') THEN RAISE EXCEPTION 'Invalid voting setup'; END IF;
  IF NEW."presentationOptions"->'meeting'->>'status'='CANCELLED' AND NEW.state<>'COMPLETED' THEN RAISE EXCEPTION 'Cancelled voting is closed'; END IF;
  IF TG_OP='UPDATE' AND OLD.state='DRAFT' AND NEW.state='OPEN' AND OLD."presentationOptions"->'meeting'->>'status'='SCHEDULED' AND (OLD."presentationOptions"->'meeting'->>'plannedAt')::timestamptz>clock_timestamp() AND current_setting('outclass.voting_early_start',true) IS DISTINCT FROM 'confirmed' THEN RAISE EXCEPTION 'Confirm early voting start'; END IF;
 END IF;
 IF TG_OP='UPDATE' AND OLD."presentationOptions"->'meeting'->>'status'='CANCELLED' AND NEW.state<>OLD.state THEN RAISE EXCEPTION 'Cancelled voting is closed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "VotingSession_meeting_guard" BEFORE INSERT OR UPDATE ON "VotingSession" FOR EACH ROW EXECUTE FUNCTION outclass_voting_meeting_guard();
REVOKE ALL ON FUNCTION outclass_voting_candidate_setup_guard(),outclass_voting_meeting_guard() FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON FUNCTION outclass_voting_candidate_setup_guard(),outclass_voting_meeting_guard() FROM anon; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON FUNCTION outclass_voting_candidate_setup_guard(),outclass_voting_meeting_guard() FROM authenticated; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN GRANT EXECUTE ON FUNCTION outclass_voting_candidate_setup_guard(),outclass_voting_meeting_guard() TO outclass_production_app; END IF;
END $$;
-- Existing private-table RLS, browser-role revocations, ballot guards, frozen
-- presentation snapshots and immutable command/audit receipts remain authoritative.
COMMIT;
