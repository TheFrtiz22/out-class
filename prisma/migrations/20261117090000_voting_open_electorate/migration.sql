-- Open electorate for live voting sessions. A session whose presentationOptions carries
-- "electorate":"OPEN" (set by the server on every session created or edited since the voter picker
-- was retired) takes its voters from the members who join it, including people who arrive after it
-- starts. Sessions without the marker keep their saved voter list and behave exactly as before.
--
-- Replaces two guard function bodies only:
--  * outclass_live_voting_roster_guard: an open session may add a voter row after it starts, but only
--    as a join (joinedAt set) while the session is neither completed nor finalized, for a member of the
--    session's club; a join time, once set in an open session, never changes. Everything else unchanged.
--  * outclass_voting_ballot_rule_guard: in an open session every member named in a captured electorate
--    must have joined the session, and a later version (the snapshot taken as the leader closes a
--    ballot, while it is still open) keeps the rule unchanged and gives a reason but may name anyone
--    who joined. Legacy sessions keep the remove-only resolution rule.
-- No table, column, trigger, row, grant, revoke or policy changes. Both functions stay SECURITY INVOKER
-- with the pinned search_path (20261109140000); CREATE OR REPLACE keeps their owner and ACL.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION outclass_live_voting_roster_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE s "VotingSession"; open_electorate boolean;
BEGIN
 IF TG_OP='DELETE' THEN
  SELECT * INTO s FROM "VotingSession" WHERE id=OLD."sessionId" FOR UPDATE;
  IF s.mode='LIVE' AND NOT (s.state='DRAFT' AND s."startedAt" IS NULL AND s."joinOpenedAt" IS NULL AND NOT EXISTS(SELECT 1 FROM "VotingPass" WHERE "sessionId"=s.id) AND current_setting('outclass.voting_setup_edit',true) IS NOT DISTINCT FROM 'confirmed') THEN RAISE EXCEPTION 'Live voting roster is frozen'; END IF;
  RETURN OLD;
 END IF;
 SELECT * INTO s FROM "VotingSession" WHERE id=NEW."sessionId" FOR UPDATE;
 IF s.mode='LIVE' THEN
  open_electorate := COALESCE(s."presentationOptions"->>'electorate','')='OPEN';
  IF s.state='COMPLETED' OR s."finalizedAt" IS NOT NULL THEN RAISE EXCEPTION 'Live voting roster is frozen'; END IF;
  IF TG_OP='UPDATE' THEN
   IF (NEW."sessionId",NEW."memberId") IS DISTINCT FROM (OLD."sessionId",OLD."memberId") THEN RAISE EXCEPTION 'Live voting roster is frozen'; END IF;
   IF open_electorate AND OLD."joinedAt" IS NOT NULL AND NEW."joinedAt" IS DISTINCT FROM OLD."joinedAt" THEN RAISE EXCEPTION 'A voter''s join time cannot change'; END IF;
  ELSIF s."startedAt" IS NOT NULL AND NOT (open_electorate AND NEW."joinedAt" IS NOT NULL) THEN RAISE EXCEPTION 'Live voting roster is frozen'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "ClubMember" m WHERE m.id=NEW."memberId" AND m."clubId"=s."clubId") THEN RAISE EXCEPTION 'Live voting roster scope mismatch'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION outclass_voting_ballot_rule_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE c public."VotingPassCandidate"; prev public."VotingBallotRule"; open_electorate boolean;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Ballot rules are historical and immutable'; END IF;
 SELECT * INTO c FROM public."VotingPassCandidate" WHERE "sessionId"=NEW."sessionId" AND "passNumber"=NEW."passNumber" AND "applicationId"=NEW."applicationId" FOR UPDATE;
 IF c."ballotState" IS DISTINCT FROM 'OPEN' THEN RAISE EXCEPTION 'Ballot rules are captured only while that ballot is open'; END IF;
 open_electorate := EXISTS(SELECT 1 FROM public."VotingSession" s WHERE s.id=NEW."sessionId" AND COALESCE(s."presentationOptions"->>'electorate','')='OPEN');
 -- Open sessions: everyone counted joined this session, once each.
 IF open_electorate AND (cardinality(NEW.electorate)<>(SELECT count(DISTINCT e) FROM unnest(NEW.electorate) e)
   OR EXISTS(SELECT 1 FROM unnest(NEW.electorate) e WHERE NOT EXISTS(SELECT 1 FROM public."VotingParticipant" p WHERE p."sessionId"=NEW."sessionId" AND p."memberId"=e AND p."joinedAt" IS NOT NULL))) THEN
  RAISE EXCEPTION 'An open-session electorate may name only members who joined the session'; END IF;
 IF NEW.version=1 THEN
  IF EXISTS(SELECT 1 FROM public."VotingBallot" b WHERE b."sessionId"=NEW."sessionId" AND b."passNumber"=NEW."passNumber" AND b."applicationId"=NEW."applicationId") THEN RAISE EXCEPTION 'The rule must be captured before any ballot is cast'; END IF;
 ELSE
  SELECT * INTO prev FROM public."VotingBallotRule" WHERE "sessionId"=NEW."sessionId" AND "passNumber"=NEW."passNumber" AND "applicationId"=NEW."applicationId" AND version=NEW.version-1;
  IF open_electorate THEN
   -- The closing snapshot: who was in the room when the ballot closed. The rule never changes mid-ballot.
   IF prev."sessionId" IS NULL OR NEW.rules IS DISTINCT FROM prev.rules OR COALESCE(btrim(NEW.reason),'')='' THEN
    RAISE EXCEPTION 'A closing electorate snapshot must keep the rule and give a reason'; END IF;
  -- A resolution may only remove voters who lost eligibility; the rule itself never changes mid-ballot.
  ELSIF prev."sessionId" IS NULL OR NEW.rules IS DISTINCT FROM prev.rules OR NOT (NEW.electorate <@ prev.electorate) OR NEW.electorate=prev.electorate OR COALESCE(btrim(NEW.reason),'')='' THEN
   RAISE EXCEPTION 'An electorate resolution must keep the rule, only remove voters and give a reason'; END IF;
 END IF;
 RETURN NEW;
END $$;

COMMIT;
