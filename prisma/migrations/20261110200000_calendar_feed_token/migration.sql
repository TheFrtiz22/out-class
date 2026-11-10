BEGIN;
SET LOCAL lock_timeout = '5s';
-- Private calendar subscription links. Additive only. One row per user; the
-- secret itself is never stored, only its SHA-256 hex digest.
CREATE TABLE "CalendarFeedToken" (
 "userId" TEXT NOT NULL,
 "tokenHash" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lastUsedAt" TIMESTAMP(3),
 CONSTRAINT "CalendarFeedToken_pkey" PRIMARY KEY ("userId"),
 CONSTRAINT "CalendarFeedToken_tokenHash_format" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX "CalendarFeedToken_tokenHash_key" ON "CalendarFeedToken"("tokenHash");
ALTER TABLE "CalendarFeedToken" ADD CONSTRAINT "CalendarFeedToken_userId_fkey"
 FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalendarFeedToken" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "CalendarFeedToken" FROM PUBLIC;
DO $runtime$
DECLARE r text;
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
  EXECUTE format('REVOKE ALL ON "CalendarFeedToken" FROM %I',r);
 END IF; END LOOP;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN
  GRANT SELECT,INSERT,UPDATE,DELETE ON "CalendarFeedToken" TO outclass_production_app;
  CREATE POLICY calendar_feed_token_runtime_read ON "CalendarFeedToken" FOR SELECT TO outclass_production_app USING (true);
  CREATE POLICY calendar_feed_token_runtime_insert ON "CalendarFeedToken" FOR INSERT TO outclass_production_app WITH CHECK (true);
  CREATE POLICY calendar_feed_token_runtime_update ON "CalendarFeedToken" FOR UPDATE TO outclass_production_app USING (true) WITH CHECK (true);
  CREATE POLICY calendar_feed_token_runtime_delete ON "CalendarFeedToken" FOR DELETE TO outclass_production_app USING (true);
 END IF;
END $runtime$;
COMMIT;
