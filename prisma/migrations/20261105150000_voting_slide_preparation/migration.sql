BEGIN;
SET LOCAL lock_timeout = '5s';
-- Leader-prepared applicant slide highlights. Additive only: no existing table,
-- column, trigger, grant or row is changed.
--
-- VotingSlidePreparation: the editable working copy for one session applicant.
-- VotingSlideLock: the immutable copy used by one voting pass, created when that
-- pass starts, before its applicant is presented. Later source or preparation
-- edits never rewrite a lock.
CREATE TABLE "VotingSlidePreparation" (
 "sessionId" TEXT NOT NULL,
 "applicationId" TEXT NOT NULL,
 highlights JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(highlights)='array' AND jsonb_array_length(highlights)<=3),
 revision INTEGER NOT NULL DEFAULT 1 CHECK (revision>0),
 "updatedBy" TEXT NOT NULL,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("sessionId","applicationId"),
 FOREIGN KEY ("sessionId","applicationId") REFERENCES "VotingCandidate"("sessionId","applicationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "VotingSlideLock" (
 "sessionId" TEXT NOT NULL,
 "passNumber" INTEGER NOT NULL,
 "applicationId" TEXT NOT NULL,
 highlights JSONB NOT NULL CHECK (jsonb_typeof(highlights)='array' AND jsonb_array_length(highlights) BETWEEN 1 AND 3),
 "preparationRevision" INTEGER NOT NULL CHECK ("preparationRevision">0),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("sessionId","passNumber","applicationId"),
 FOREIGN KEY ("sessionId","passNumber","applicationId") REFERENCES "VotingPassCandidate"("sessionId","passNumber","applicationId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE FUNCTION outclass_voting_slide_preparation_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE s public."VotingSession";
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Slide preparation history is retained; save an empty highlight list instead'; END IF;
 SELECT * INTO s FROM public."VotingSession" WHERE id=NEW."sessionId";
 -- An ended but unfinalized meeting can still resume for Hold passes.
 IF s.mode<>'LIVE' OR s."finalizedAt" IS NOT NULL THEN RAISE EXCEPTION 'Slide preparation is closed for this session'; END IF;
 IF TG_OP='UPDATE' AND (NEW."sessionId"<>OLD."sessionId" OR NEW."applicationId"<>OLD."applicationId" OR NEW.revision<>OLD.revision+1) THEN
  RAISE EXCEPTION 'Slide preparation changed concurrently; reload before saving'; END IF;
 IF TG_OP='INSERT' AND NEW.revision<>1 THEN RAISE EXCEPTION 'Slide preparation starts at revision 1'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "VotingSlidePreparation_guard" BEFORE INSERT OR UPDATE OR DELETE ON "VotingSlidePreparation" FOR EACH ROW EXECUTE FUNCTION outclass_voting_slide_preparation_guard();

CREATE FUNCTION outclass_voting_slide_lock_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE c public."VotingPassCandidate"; p public."VotingSlidePreparation";
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Locked voting slides are immutable'; END IF;
 SELECT * INTO c FROM public."VotingPassCandidate" WHERE "sessionId"=NEW."sessionId" AND "passNumber"=NEW."passNumber" AND "applicationId"=NEW."applicationId";
 SELECT * INTO p FROM public."VotingSlidePreparation" WHERE "sessionId"=NEW."sessionId" AND "applicationId"=NEW."applicationId";
 -- Only the saved preparation, copied when its pass is created and before the
 -- applicant is presented or voted on.
 IF c."ballotState"<>'PENDING' OR c."openedAt" IS NOT NULL OR c."confirmedDecision" IS NOT NULL
  OR EXISTS(SELECT 1 FROM public."VotingBallot" b WHERE b."sessionId"=NEW."sessionId" AND b."passNumber"=NEW."passNumber" AND b."applicationId"=NEW."applicationId")
  OR p."sessionId" IS NULL OR p.revision<>NEW."preparationRevision" OR p.highlights IS DISTINCT FROM NEW.highlights
 THEN RAISE EXCEPTION 'Only the saved preparation can be locked before its applicant is presented'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "VotingSlideLock_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "VotingSlideLock" FOR EACH ROW EXECUTE FUNCTION outclass_voting_slide_lock_guard();

ALTER TABLE "VotingSlidePreparation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VotingSlideLock" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "VotingSlidePreparation","VotingSlideLock" FROM PUBLIC;
REVOKE ALL ON FUNCTION outclass_voting_slide_preparation_guard(),outclass_voting_slide_lock_guard() FROM PUBLIC;
DO $runtime$
DECLARE r text;
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
  EXECUTE format('REVOKE ALL ON "VotingSlidePreparation","VotingSlideLock" FROM %I',r);
  EXECUTE format('REVOKE ALL ON FUNCTION outclass_voting_slide_preparation_guard(),outclass_voting_slide_lock_guard() FROM %I',r);
 END IF; END LOOP;
 -- Only the existing bounded server role; it is neither superuser nor BYPASSRLS,
 -- so explicit row policies are required (see 20261103200000). Leader and
 -- viewer authority is checked by the server actions; no DELETE is granted.
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN
  GRANT SELECT,INSERT,UPDATE ON "VotingSlidePreparation" TO outclass_production_app;
  GRANT SELECT,INSERT ON "VotingSlideLock" TO outclass_production_app;
  GRANT EXECUTE ON FUNCTION outclass_voting_slide_preparation_guard(),outclass_voting_slide_lock_guard() TO outclass_production_app;
  CREATE POLICY voting_slide_preparation_runtime_read ON "VotingSlidePreparation" FOR SELECT TO outclass_production_app USING (true);
  CREATE POLICY voting_slide_preparation_runtime_insert ON "VotingSlidePreparation" FOR INSERT TO outclass_production_app WITH CHECK (true);
  CREATE POLICY voting_slide_preparation_runtime_update ON "VotingSlidePreparation" FOR UPDATE TO outclass_production_app USING (true) WITH CHECK (true);
  CREATE POLICY voting_slide_lock_runtime_read ON "VotingSlideLock" FOR SELECT TO outclass_production_app USING (true);
  CREATE POLICY voting_slide_lock_runtime_insert ON "VotingSlideLock" FOR INSERT TO outclass_production_app WITH CHECK (true);
 END IF;
END $runtime$;
COMMIT;
