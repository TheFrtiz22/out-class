BEGIN;
CREATE TABLE "SavedCampusEvent" (
  "userId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedCampusEvent_pkey" PRIMARY KEY ("userId", "eventId"),
  CONSTRAINT "SavedCampusEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SavedCampusEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SavedCampusEvent_eventId_idx" ON "SavedCampusEvent"("eventId");
ALTER TABLE "SavedCampusEvent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "SavedCampusEvent" FROM PUBLIC, anon, authenticated;
CREATE POLICY outclass_saved_events_server_only ON "SavedCampusEvent" AS RESTRICTIVE FOR ALL TO PUBLIC USING(false) WITH CHECK(false);
-- Match the existing bounded server-role ownership model.
DO $migration$
DECLARE had_create BOOLEAN;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN RETURN; END IF;
 had_create := has_schema_privilege('outclass_production_app','public','CREATE');
 IF NOT had_create THEN GRANT CREATE ON SCHEMA public TO outclass_production_app; END IF;
 ALTER TABLE "SavedCampusEvent" OWNER TO outclass_production_app;
 IF NOT had_create THEN REVOKE CREATE ON SCHEMA public FROM outclass_production_app; END IF;
END $migration$;
COMMIT;
