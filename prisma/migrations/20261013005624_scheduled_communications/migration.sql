BEGIN;
CREATE TABLE public."ScheduledCommunication" (
 "id" TEXT PRIMARY KEY, "clubId" TEXT NOT NULL REFERENCES public."Club"(id) ON DELETE CASCADE,
 "senderId" TEXT NOT NULL REFERENCES public."User"(id) ON DELETE RESTRICT,
 "actorId" TEXT NOT NULL, "supportSessionId" TEXT,
 "kind" TEXT NOT NULL DEFAULT 'ANNOUNCEMENT' CHECK (kind='ANNOUNCEMENT'),
 "title" TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
 "body" TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 10000),
 "audience" JSONB NOT NULL CHECK (jsonb_typeof(audience)='object'),
 "snapshot" JSONB NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
 "recipientMode" TEXT NOT NULL CHECK ("recipientMode" IN ('FIXED','SEND_TIME')),
 "scheduledAt" TIMESTAMP(3) NOT NULL, "timeZone" TEXT NOT NULL, "localTime" TEXT NOT NULL,
 "occurrence" TEXT NOT NULL CHECK (occurrence IN ('EARLIER','LATER')),
 "status" TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','PROCESSING','PUBLISHED','FAILED','CANCELLED')),
 "revision" INTEGER NOT NULL DEFAULT 0 CHECK (revision>=0), "requestKey" TEXT NOT NULL,
 "publicationId" TEXT UNIQUE REFERENCES public."ClubAnnouncement"(id) ON DELETE RESTRICT,
 "recipientCount" INTEGER CHECK ("recipientCount">=0), "failureCode" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 UNIQUE ("clubId","requestKey"),
 CHECK ((status='PUBLISHED')=("publicationId" IS NOT NULL))
);
CREATE INDEX "ScheduledCommunication_status_scheduledAt_idx" ON public."ScheduledCommunication"(status,"scheduledAt");
CREATE INDEX "ScheduledCommunication_clubId_createdAt_idx" ON public."ScheduledCommunication"("clubId","createdAt");
ALTER TABLE public."ScheduledCommunication" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ScheduledCommunication" FROM PUBLIC,anon,authenticated;
CREATE POLICY outclass_scheduled_server_only ON public."ScheduledCommunication" AS RESTRICTIVE FOR ALL TO PUBLIC USING(false) WITH CHECK(false);
DO $migration$
DECLARE had_create BOOLEAN;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN RETURN; END IF;
 had_create := has_schema_privilege('outclass_production_app','public','CREATE');
 IF NOT had_create THEN GRANT CREATE ON SCHEMA public TO outclass_production_app; END IF;
 ALTER TABLE public."ScheduledCommunication" OWNER TO outclass_production_app;
 IF NOT had_create THEN REVOKE CREATE ON SCHEMA public FROM outclass_production_app; END IF;
END $migration$;
COMMIT;
