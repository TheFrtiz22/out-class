BEGIN;
SET LOCAL lock_timeout = '5s';
-- Club voting rules for live rooms. Additive only: existing sessions have no
-- rule rows and keep leader-confirmed behaviour; no existing table, trigger,
-- grant or row is changed.
--
-- VotingRuleDefault: a club default (roundId NULL) or a per-round override.
-- VotingBallotRule: the rule and eligible electorate captured for one ballot
-- instance when voting opens (version 1), plus audited electorate resolutions
-- (later versions, removals only) before that ballot closes. Insert-only.
CREATE TABLE "VotingRuleDefault" (
 id TEXT PRIMARY KEY,
 "clubId" TEXT NOT NULL REFERENCES "Club"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "roundId" TEXT REFERENCES "PipelineRound"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 rules JSONB NOT NULL CHECK (jsonb_typeof(rules)='object' AND rules->>'mode' IN ('LEADER_CONFIRMS','THRESHOLD')),
 revision INTEGER NOT NULL DEFAULT 1 CHECK (revision>0),
 "updatedBy" TEXT NOT NULL,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "VotingRuleDefault_club_round_key" ON "VotingRuleDefault"("clubId",COALESCE("roundId",''));

CREATE TABLE "VotingBallotRule" (
 "sessionId" TEXT NOT NULL,
 "passNumber" INTEGER NOT NULL,
 "applicationId" TEXT NOT NULL,
 version INTEGER NOT NULL CHECK (version>0),
 rules JSONB NOT NULL CHECK (jsonb_typeof(rules)='object' AND rules->>'mode' IN ('LEADER_CONFIRMS','THRESHOLD')),
 electorate TEXT[] NOT NULL,
 reason TEXT,
 "createdBy" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("sessionId","passNumber","applicationId",version),
 FOREIGN KEY ("sessionId","passNumber","applicationId") REFERENCES "VotingPassCandidate"("sessionId","passNumber","applicationId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE FUNCTION outclass_voting_rule_default_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Voting rule defaults are retained; save leader-confirmed voting instead'; END IF;
 IF NEW."roundId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public."PipelineRound" r WHERE r.id=NEW."roundId" AND r."clubId"=NEW."clubId") THEN RAISE EXCEPTION 'Round belongs to another club'; END IF;
 IF TG_OP='UPDATE' AND (NEW."clubId"<>OLD."clubId" OR NEW."roundId" IS DISTINCT FROM OLD."roundId" OR NEW.revision<>OLD.revision+1) THEN RAISE EXCEPTION 'Voting rule default changed concurrently; reload before saving'; END IF;
 IF TG_OP='INSERT' AND NEW.revision<>1 THEN RAISE EXCEPTION 'Voting rule defaults start at revision 1'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "VotingRuleDefault_guard" BEFORE INSERT OR UPDATE OR DELETE ON "VotingRuleDefault" FOR EACH ROW EXECUTE FUNCTION outclass_voting_rule_default_guard();

CREATE FUNCTION outclass_voting_ballot_rule_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE c public."VotingPassCandidate"; prev public."VotingBallotRule";
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Ballot rules are historical and immutable'; END IF;
 SELECT * INTO c FROM public."VotingPassCandidate" WHERE "sessionId"=NEW."sessionId" AND "passNumber"=NEW."passNumber" AND "applicationId"=NEW."applicationId" FOR UPDATE;
 IF c."ballotState" IS DISTINCT FROM 'OPEN' THEN RAISE EXCEPTION 'Ballot rules are captured only while that ballot is open'; END IF;
 IF NEW.version=1 THEN
  IF EXISTS(SELECT 1 FROM public."VotingBallot" b WHERE b."sessionId"=NEW."sessionId" AND b."passNumber"=NEW."passNumber" AND b."applicationId"=NEW."applicationId") THEN RAISE EXCEPTION 'The rule must be captured before any ballot is cast'; END IF;
 ELSE
  SELECT * INTO prev FROM public."VotingBallotRule" WHERE "sessionId"=NEW."sessionId" AND "passNumber"=NEW."passNumber" AND "applicationId"=NEW."applicationId" AND version=NEW.version-1;
  -- A resolution may only remove voters who lost eligibility; the rule itself never changes mid-ballot.
  IF prev."sessionId" IS NULL OR NEW.rules IS DISTINCT FROM prev.rules OR NOT (NEW.electorate <@ prev.electorate) OR NEW.electorate=prev.electorate OR COALESCE(btrim(NEW.reason),'')='' THEN
   RAISE EXCEPTION 'An electorate resolution must keep the rule, only remove voters and give a reason'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "VotingBallotRule_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "VotingBallotRule" FOR EACH ROW EXECUTE FUNCTION outclass_voting_ballot_rule_guard();

ALTER TABLE "VotingRuleDefault" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VotingBallotRule" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "VotingRuleDefault","VotingBallotRule" FROM PUBLIC;
REVOKE ALL ON FUNCTION outclass_voting_rule_default_guard(),outclass_voting_ballot_rule_guard() FROM PUBLIC;
DO $runtime$
DECLARE r text;
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
  EXECUTE format('REVOKE ALL ON "VotingRuleDefault","VotingBallotRule" FROM %I',r);
  EXECUTE format('REVOKE ALL ON FUNCTION outclass_voting_rule_default_guard(),outclass_voting_ballot_rule_guard() FROM %I',r);
 END IF; END LOOP;
 -- Only the existing bounded server role, with explicit row policies (see 20261103200000).
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN
  GRANT SELECT,INSERT,UPDATE ON "VotingRuleDefault" TO outclass_production_app;
  GRANT SELECT,INSERT ON "VotingBallotRule" TO outclass_production_app;
  GRANT EXECUTE ON FUNCTION outclass_voting_rule_default_guard(),outclass_voting_ballot_rule_guard() TO outclass_production_app;
  CREATE POLICY voting_rule_default_runtime_read ON "VotingRuleDefault" FOR SELECT TO outclass_production_app USING (true);
  CREATE POLICY voting_rule_default_runtime_insert ON "VotingRuleDefault" FOR INSERT TO outclass_production_app WITH CHECK (true);
  CREATE POLICY voting_rule_default_runtime_update ON "VotingRuleDefault" FOR UPDATE TO outclass_production_app USING (true) WITH CHECK (true);
  CREATE POLICY voting_ballot_rule_runtime_read ON "VotingBallotRule" FOR SELECT TO outclass_production_app USING (true);
  CREATE POLICY voting_ballot_rule_runtime_insert ON "VotingBallotRule" FOR INSERT TO outclass_production_app WITH CHECK (true);
 END IF;
END $runtime$;
COMMIT;
