BEGIN;
-- Extend existing observations; legacy PRO/CON rows and permissions are retained.
ALTER TABLE "ApplicantObservation" DROP CONSTRAINT "ApplicantObservation_kind_check";
ALTER TABLE "ApplicantObservation" ADD CONSTRAINT "ApplicantObservation_kind_check" CHECK (kind IN ('PRO','CON','ADDITIONAL'));
ALTER TABLE "ApplicantObservation"
 ADD COLUMN "clubId" TEXT,
 ADD COLUMN "cycleId" TEXT,
 ADD COLUMN "roundId" TEXT,
 ADD COLUMN "interactionContext" TEXT,
 ADD COLUMN revision INTEGER NOT NULL DEFAULT 1,
 ADD COLUMN history JSONB NOT NULL DEFAULT '[]',
 ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "ApplicantObservation" ADD CONSTRAINT "ApplicantObservation_additional_content" CHECK (
 kind<>'ADDITIONAL' OR ("clubId" IS NOT NULL AND "cycleId" IS NOT NULL AND "roundId" IS NOT NULL AND revision>0 AND NOT "anonymousReview"
 AND jsonb_typeof(history)='array' AND jsonb_array_length(history)=revision AND length(COALESCE("interactionContext",''))<=160));
ALTER TABLE "ApplicantObservation" ADD CONSTRAINT "ApplicantObservation_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicantObservation" ADD CONSTRAINT "ApplicantObservation_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "RecruitmentCycle"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicantObservation" ADD CONSTRAINT "ApplicantObservation_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "PipelineRound"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "VotingObservationReference" (
 "sessionId" TEXT NOT NULL REFERENCES "VotingSession"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "observationId" TEXT NOT NULL REFERENCES "ApplicantObservation"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "applicationId" TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK (revision>0),
 snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("sessionId","observationId")
);
CREATE INDEX "VotingObservationReference_sessionId_applicationId_idx" ON "VotingObservationReference"("sessionId","applicationId");
ALTER TABLE "VotingObservationReference" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "VotingObservationReference" FROM PUBLIC;
CREATE FUNCTION outclass_additional_observation_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE a public."Application";
BEGIN
 IF TG_OP='DELETE' THEN IF OLD.kind='ADDITIONAL' THEN RAISE EXCEPTION 'Additional observation history is retained'; END IF; RETURN OLD; END IF;
 IF TG_OP='UPDATE' AND OLD.kind='ADDITIONAL' THEN
  IF NEW.kind<>OLD.kind OR NEW."applicationId"<>OLD."applicationId" OR NEW."authorId"<>OLD."authorId"
   OR NEW."clubId" IS DISTINCT FROM OLD."clubId" OR NEW."cycleId" IS DISTINCT FROM OLD."cycleId"
   OR NEW."roundId" IS DISTINCT FROM OLD."roundId" OR NEW."createdAt"<>OLD."createdAt"
   OR NEW.revision<>OLD.revision+1 OR NEW.history->OLD.revision IS NULL
   OR (SELECT jsonb_agg(v ORDER BY n) FROM jsonb_array_elements(NEW.history) WITH ORDINALITY AS e(v,n) WHERE n<=OLD.revision) IS DISTINCT FROM OLD.history
  THEN RAISE EXCEPTION 'Observation identity/history is immutable; append a revision'; END IF;
 ELSIF TG_OP='UPDATE' AND NEW.kind='ADDITIONAL' THEN RAISE EXCEPTION 'Legacy observations cannot be relabelled'; END IF;
 IF NEW.kind='ADDITIONAL' THEN
  -- ECMAScript whitespace, matching the shared client/server word counter.
  IF cardinality(regexp_split_to_array(btrim(regexp_replace(NEW.body,E'[\\t\\n\\v\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+',' ','g')),' '))>50 THEN RAISE EXCEPTION 'Use 50 words or fewer'; END IF;
  SELECT * INTO a FROM public."Application" WHERE id=NEW."applicationId";
  IF a."clubId" IS DISTINCT FROM NEW."clubId" OR a."recruitmentCycleId" IS DISTINCT FROM NEW."cycleId"
   OR NOT EXISTS(SELECT 1 FROM public."PipelineRound" r WHERE r.id=NEW."roundId" AND r."clubId"=NEW."clubId")
   OR NEW.history->(NEW.revision-1)->>'body' IS DISTINCT FROM NEW.body
   OR NEW.history->(NEW.revision-1)->>'interactionContext' IS DISTINCT FROM COALESCE(NEW."interactionContext",'')
   OR (NEW.history->(NEW.revision-1)->>'removed')::boolean IS DISTINCT FROM (NEW."deletedAt" IS NOT NULL)
   THEN RAISE EXCEPTION 'Observation context or revision mismatch'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "ApplicantObservation_revision_guard" BEFORE INSERT OR UPDATE OR DELETE ON "ApplicantObservation" FOR EACH ROW EXECUTE FUNCTION outclass_additional_observation_guard();
CREATE FUNCTION outclass_voting_observation_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE s public."VotingSession"; o public."ApplicantObservation";
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Voting observation references are immutable'; END IF;
 SELECT * INTO s FROM public."VotingSession" WHERE id=NEW."sessionId" FOR UPDATE;
 SELECT * INTO o FROM public."ApplicantObservation" WHERE id=NEW."observationId";
 IF s.mode<>'LIVE' OR s.state<>'DRAFT' OR s."startedAt" IS NOT NULL
 OR o.kind<>'ADDITIONAL' OR o."deletedAt" IS NOT NULL OR o."clubId" IS DISTINCT FROM s."clubId" OR o."cycleId" IS DISTINCT FROM s."cycleId"
 OR o."applicationId"<>NEW."applicationId" OR o.revision<>NEW.revision
 OR NOT EXISTS(SELECT 1 FROM public."VotingCandidate" c WHERE c."sessionId"=s.id AND c."applicationId"=NEW."applicationId")
 OR NEW.snapshot->>'id' IS DISTINCT FROM o.id OR NEW.snapshot->>'body' IS DISTINCT FROM o.body
 OR (NEW.snapshot->>'revision')::integer IS DISTINCT FROM o.revision
 OR NEW.snapshot->>'interactionContext' IS DISTINCT FROM COALESCE(o."interactionContext",'')
 THEN RAISE EXCEPTION 'Only the current authorized observation version can be pinned before voting'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "VotingObservationReference_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "VotingObservationReference" FOR EACH ROW EXECUTE FUNCTION outclass_voting_observation_guard();
REVOKE ALL ON FUNCTION outclass_additional_observation_guard(),outclass_voting_observation_guard() FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
  EXECUTE format('REVOKE ALL ON "VotingObservationReference" FROM %I',r);
  EXECUTE format('REVOKE ALL ON FUNCTION outclass_additional_observation_guard(),outclass_voting_observation_guard() FROM %I',r);
 END IF; END LOOP;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN
  GRANT SELECT,INSERT ON "VotingObservationReference" TO outclass_production_app;
  GRANT EXECUTE ON FUNCTION outclass_additional_observation_guard(),outclass_voting_observation_guard() TO outclass_production_app;
 END IF;
END $$;
COMMIT;
