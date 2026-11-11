BEGIN;
SET LOCAL lock_timeout = '5s';
-- Editing an unstarted voting session after slides were prepared.
--
-- Setup edits now keep each retained applicant's candidate row (and its
-- prepared highlights), renumber or re-snapshot it in place, and remove only
-- applicants the leader dropped. Two guards are narrowed for that, and only
-- under the existing transaction-local outclass.voting_setup_edit='confirmed'
-- flag that updateVotingSessionSetup already sets, while the LIVE session is
-- unstarted (DRAFT, no startedAt/joinOpenedAt/finalizedAt, no VotingPass):
--   1. a LIVE candidate row may change position and expectedStatus only;
--   2. that session's slide-preparation working copy may be deleted for an
--      applicant the edit removes (listed by the action in the transaction-local
--      outclass.voting_setup_discard, comma-separated application IDs), unless a
--      locked slide exists for it.
-- Every other refusal is unchanged. Function bodies otherwise match the
-- current definitions; SECURITY INVOKER and search_path=pg_catalog, public are
-- kept, and CREATE OR REPLACE keeps owners and grants.
--
-- The bounded runtime role gets DELETE on VotingSlidePreparation and one DELETE
-- policy, in the same shape as its existing read/insert/update grants and
-- policies (20261105150000), so the server action can discard a removed
-- applicant's working copy. The guard trigger above stays the real gate. Nothing
-- is granted to anon, authenticated or PUBLIC, and no other grant or policy
-- changes. No tables, columns, constraints or rows are changed; the RESTRICT
-- foreign key from VotingSlidePreparation to VotingCandidate stays.

CREATE OR REPLACE FUNCTION outclass_voting_candidate_setup_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE s "VotingSession";
BEGIN
 SELECT * INTO s FROM "VotingSession" WHERE id=OLD."sessionId" FOR UPDATE;
 IF s.mode='LIVE' AND NOT (s.state='DRAFT' AND s."startedAt" IS NULL AND s."joinOpenedAt" IS NULL AND current_setting('outclass.voting_setup_edit',true) IS NOT DISTINCT FROM 'confirmed' AND NOT EXISTS(SELECT 1 FROM "VotingPass" WHERE "sessionId"=s.id)) THEN RAISE EXCEPTION 'Live voting roster is frozen'; END IF;
 IF TG_OP='UPDATE' THEN
  -- Reached for LIVE only under the confirmed unstarted setup edit above: a kept
  -- applicant may be renumbered or re-snapshotted, never re-keyed or published.
  IF s.mode='LIVE' AND (s."finalizedAt" IS NOT NULL OR (NEW."sessionId",NEW."applicationId",NEW."publishedStatus") IS DISTINCT FROM (OLD."sessionId",OLD."applicationId",OLD."publishedStatus")) THEN RAISE EXCEPTION 'Replace the unstarted candidate selection explicitly'; END IF;
  RETURN NEW;
 END IF;
 RETURN OLD;
END $$;

CREATE OR REPLACE FUNCTION outclass_voting_slide_preparation_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE s public."VotingSession";
BEGIN
 IF TG_OP='DELETE' THEN
  -- Only a confirmed setup edit removing this applicant from a session that has
  -- never started may discard its working copy. Locked slides are separate rows
  -- and stay immutable.
  IF current_setting('outclass.voting_setup_edit',true) IS NOT DISTINCT FROM 'confirmed'
   AND OLD."applicationId" = ANY(string_to_array(current_setting('outclass.voting_setup_discard',true),',')) THEN
   SELECT * INTO s FROM public."VotingSession" WHERE id=OLD."sessionId" FOR UPDATE;
   IF s.mode='LIVE' AND s.state='DRAFT' AND s."startedAt" IS NULL AND s."joinOpenedAt" IS NULL AND s."finalizedAt" IS NULL
    AND NOT EXISTS(SELECT 1 FROM public."VotingPass" WHERE "sessionId"=s.id)
    AND NOT EXISTS(SELECT 1 FROM public."VotingSlideLock" l WHERE l."sessionId"=OLD."sessionId" AND l."applicationId"=OLD."applicationId")
   THEN RETURN OLD; END IF;
  END IF;
  RAISE EXCEPTION 'Slide preparation history is retained; save an empty highlight list instead';
 END IF;
 SELECT * INTO s FROM public."VotingSession" WHERE id=NEW."sessionId";
 -- An ended but unfinalized meeting can still resume for Hold passes.
 IF s.mode<>'LIVE' OR s."finalizedAt" IS NOT NULL THEN RAISE EXCEPTION 'Slide preparation is closed for this session'; END IF;
 IF TG_OP='UPDATE' AND (NEW."sessionId"<>OLD."sessionId" OR NEW."applicationId"<>OLD."applicationId" OR NEW.revision<>OLD.revision+1) THEN
  RAISE EXCEPTION 'Slide preparation changed concurrently; reload before saving'; END IF;
 IF TG_OP='INSERT' AND NEW.revision<>1 THEN RAISE EXCEPTION 'Slide preparation starts at revision 1'; END IF;
 RETURN NEW;
END $$;

DO $runtime$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN
  GRANT DELETE ON "VotingSlidePreparation" TO outclass_production_app;
  CREATE POLICY voting_slide_preparation_runtime_delete ON "VotingSlidePreparation" FOR DELETE TO outclass_production_app USING (true);
 END IF;
END $runtime$;
COMMIT;
