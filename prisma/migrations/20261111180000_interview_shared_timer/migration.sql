BEGIN; SET LOCAL lock_timeout='5s';
-- One shared countdown per interview collaboration room (application + round +
-- booked room or manual panel). Additive only: no existing table, trigger, grant
-- or row is changed. Remaining time is derived from these server timestamps;
-- the browser never reads this table directly.
CREATE TABLE "InterviewTimer" (
 "sessionId" TEXT NOT NULL,
 "durationMs" INTEGER NOT NULL,
 "contextKey" TEXT NOT NULL,
 "startedAt" TIMESTAMP(3),
 "pausedAt" TIMESTAMP(3),
 "pausedMs" INTEGER NOT NULL DEFAULT 0,
 "revision" INTEGER NOT NULL DEFAULT 1,
 "lastRequestId" TEXT,
 "updatedBy" TEXT,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "InterviewTimer_pkey" PRIMARY KEY ("sessionId"),
 CONSTRAINT "InterviewTimer_duration_range" CHECK ("durationMs" BETWEEN 0 AND 14400000),
 CONSTRAINT "InterviewTimer_paused_ms" CHECK ("pausedMs" >= 0),
 CONSTRAINT "InterviewTimer_revision" CHECK ("revision" >= 1),
 CONSTRAINT "InterviewTimer_context_key" CHECK (length("contextKey") BETWEEN 1 AND 300),
 CONSTRAINT "InterviewTimer_request_id" CHECK ("lastRequestId" IS NULL OR length("lastRequestId") BETWEEN 1 AND 64),
 CONSTRAINT "InterviewTimer_state" CHECK (("startedAt" IS NOT NULL OR ("pausedAt" IS NULL AND "pausedMs" = 0)) AND ("pausedAt" IS NULL OR "pausedAt" >= "startedAt"))
);
ALTER TABLE "InterviewTimer" ADD CONSTRAINT "InterviewTimer_sessionId_fkey"
 FOREIGN KEY ("sessionId") REFERENCES "InterviewCollaboration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewTimer" ADD CONSTRAINT "InterviewTimer_updatedBy_fkey"
 FOREIGN KEY ("updatedBy") REFERENCES "ClubMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE FUNCTION outclass_interview_timer_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 -- A removed member's attribution is cleared (ON DELETE SET NULL) without a timer change.
 IF TG_OP='UPDATE' AND NEW."updatedBy" IS NULL AND OLD."updatedBy" IS NOT NULL
  AND (NEW."sessionId",NEW."durationMs",NEW."contextKey",NEW."startedAt",NEW."pausedAt",NEW."pausedMs",NEW.revision,NEW."lastRequestId",NEW."updatedAt")
   IS NOT DISTINCT FROM (OLD."sessionId",OLD."durationMs",OLD."contextKey",OLD."startedAt",OLD."pausedAt",OLD."pausedMs",OLD.revision,OLD."lastRequestId",OLD."updatedAt") THEN
  RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND (NEW."sessionId"<>OLD."sessionId" OR NEW.revision<>OLD.revision+1) THEN
  RAISE EXCEPTION 'Interview timer identity/revision mismatch'; END IF;
 IF NEW."updatedBy" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public."InterviewCollaboration" c JOIN public."ClubMember" m ON m."clubId"=c."clubId" WHERE c.id=NEW."sessionId" AND m.id=NEW."updatedBy") THEN
  RAISE EXCEPTION 'Interview timer member scope mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "InterviewTimer_guard" BEFORE INSERT OR UPDATE ON "InterviewTimer" FOR EACH ROW EXECUTE FUNCTION outclass_interview_timer_guard();

ALTER TABLE "InterviewTimer" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "InterviewTimer" FROM PUBLIC;
REVOKE ALL ON FUNCTION outclass_interview_timer_guard() FROM PUBLIC;
DO $runtime$
DECLARE r text;
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
  EXECUTE format('REVOKE ALL ON "InterviewTimer" FROM %I',r);
  EXECUTE format('REVOKE ALL ON FUNCTION outclass_interview_timer_guard() FROM %I',r);
 END IF; END LOOP;
 -- Only the existing bounded server role, with explicit row policies (see 20261103200000).
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN
  GRANT SELECT,INSERT,UPDATE ON "InterviewTimer" TO outclass_production_app;
  GRANT EXECUTE ON FUNCTION outclass_interview_timer_guard() TO outclass_production_app;
  CREATE POLICY interview_timer_runtime_read ON "InterviewTimer" FOR SELECT TO outclass_production_app USING (true);
  CREATE POLICY interview_timer_runtime_insert ON "InterviewTimer" FOR INSERT TO outclass_production_app WITH CHECK (true);
  CREATE POLICY interview_timer_runtime_update ON "InterviewTimer" FOR UPDATE TO outclass_production_app USING (true) WITH CHECK (true);
 END IF;
END $runtime$;
COMMIT;
