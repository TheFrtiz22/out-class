BEGIN;
ALTER TABLE public."Application" ADD COLUMN "decisionStateRevision" INTEGER NOT NULL DEFAULT 0 CHECK("decisionStateRevision">=0);
CREATE FUNCTION public.outclass_decision_state_revision() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF (NEW.status,NEW."roundId",NEW."decisionVersion",NEW."recruitmentCycleId") IS DISTINCT FROM (OLD.status,OLD."roundId",OLD."decisionVersion",OLD."recruitmentCycleId") THEN
  NEW."decisionStateRevision" := OLD."decisionStateRevision" + 1;
 ELSE NEW."decisionStateRevision" := OLD."decisionStateRevision";
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.outclass_decision_state_revision() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER outclass_decision_state_revision BEFORE UPDATE ON public."Application" FOR EACH ROW EXECUTE FUNCTION public.outclass_decision_state_revision();

ALTER TABLE public."ScheduledCommunication" DROP CONSTRAINT "ScheduledCommunication_kind_check";
ALTER TABLE public."ScheduledCommunication" ADD CONSTRAINT "ScheduledCommunication_kind_check" CHECK(kind IN ('ANNOUNCEMENT','DECISION'));
ALTER TABLE public."ScheduledCommunication" ADD COLUMN "decisionPublishedAt" TIMESTAMP(3);
ALTER TABLE public."ScheduledCommunication" DROP CONSTRAINT "ScheduledCommunication_check";
ALTER TABLE public."ScheduledCommunication" ADD CONSTRAINT "ScheduledCommunication_publication_check" CHECK (
 (kind='ANNOUNCEMENT' AND "decisionPublishedAt" IS NULL AND ((status='PUBLISHED')=("publicationId" IS NOT NULL))) OR
 (kind='DECISION' AND "publicationId" IS NULL AND ((status='PUBLISHED')=("decisionPublishedAt" IS NOT NULL)))
);
COMMIT;
