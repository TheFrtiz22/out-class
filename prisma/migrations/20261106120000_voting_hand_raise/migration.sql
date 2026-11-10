BEGIN;
SET LOCAL lock_timeout = '5s';
-- Lightweight "Something to add" requests in live voting rooms. Additive only:
-- no existing table, trigger, grant or row is changed. A request is scoped to
-- one session participant, one applicant and one voting pass; it never touches
-- ballots, outcomes, observations or the room revision.
CREATE TABLE "VotingHandRaise" (
 "sessionId" TEXT NOT NULL,
 "passNumber" INTEGER NOT NULL,
 "applicationId" TEXT NOT NULL,
 "memberId" TEXT NOT NULL,
 "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "withdrawnAt" TIMESTAMP(3),
 "acknowledgedAt" TIMESTAMP(3),
 "acknowledgedBy" TEXT,
 "clearedAt" TIMESTAMP(3),
 "clearedBy" TEXT,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("sessionId","passNumber","applicationId","memberId"),
 FOREIGN KEY ("sessionId","passNumber","applicationId") REFERENCES "VotingPassCandidate"("sessionId","passNumber","applicationId") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("sessionId","memberId") REFERENCES "VotingParticipant"("sessionId","memberId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE FUNCTION outclass_voting_hand_raise_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE s public."VotingSession";
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Discussion requests are retained; clear or withdraw them instead'; END IF;
 IF TG_OP='UPDATE' AND (NEW."sessionId",NEW."passNumber",NEW."applicationId",NEW."memberId") IS DISTINCT FROM (OLD."sessionId",OLD."passNumber",OLD."applicationId",OLD."memberId") THEN
  RAISE EXCEPTION 'Discussion request identity is immutable'; END IF;
 SELECT * INTO s FROM public."VotingSession" WHERE id=NEW."sessionId";
 -- Raising (or re-raising) is only for the applicant currently being presented.
 IF NEW."withdrawnAt" IS NULL AND NEW."clearedAt" IS NULL AND (TG_OP='INSERT' OR OLD."withdrawnAt" IS NOT NULL OR OLD."clearedAt" IS NOT NULL)
  AND (s.mode<>'LIVE' OR s.state<>'OPEN' OR s."finalizedAt" IS NOT NULL OR s."currentPass"<>NEW."passNumber" OR s."activeApplicationId" IS DISTINCT FROM NEW."applicationId")
 THEN RAISE EXCEPTION 'Requests are only for the applicant currently being discussed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "VotingHandRaise_guard" BEFORE INSERT OR UPDATE OR DELETE ON "VotingHandRaise" FOR EACH ROW EXECUTE FUNCTION outclass_voting_hand_raise_guard();

ALTER TABLE "VotingHandRaise" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "VotingHandRaise" FROM PUBLIC;
REVOKE ALL ON FUNCTION outclass_voting_hand_raise_guard() FROM PUBLIC;
DO $runtime$
DECLARE r text;
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
  EXECUTE format('REVOKE ALL ON "VotingHandRaise" FROM %I',r);
  EXECUTE format('REVOKE ALL ON FUNCTION outclass_voting_hand_raise_guard() FROM %I',r);
 END IF; END LOOP;
 -- Only the existing bounded server role, with explicit row policies (see 20261103200000).
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN
  GRANT SELECT,INSERT,UPDATE ON "VotingHandRaise" TO outclass_production_app;
  GRANT EXECUTE ON FUNCTION outclass_voting_hand_raise_guard() TO outclass_production_app;
  CREATE POLICY voting_hand_raise_runtime_read ON "VotingHandRaise" FOR SELECT TO outclass_production_app USING (true);
  CREATE POLICY voting_hand_raise_runtime_insert ON "VotingHandRaise" FOR INSERT TO outclass_production_app WITH CHECK (true);
  CREATE POLICY voting_hand_raise_runtime_update ON "VotingHandRaise" FOR UPDATE TO outclass_production_app USING (true) WITH CHECK (true);
 END IF;
END $runtime$;
COMMIT;
