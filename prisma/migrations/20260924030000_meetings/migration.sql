BEGIN;
-- Meeting maps to the existing Event table; all IDs, relations and attendance survive.
ALTER TABLE "Event" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'RECRUITMENT', ADD COLUMN "endDate" TIMESTAMP(3), ADD COLUMN "agenda" TEXT NOT NULL DEFAULT '', ADD COLUMN "recap" TEXT NOT NULL DEFAULT '', ADD COLUMN "resources" JSONB NOT NULL DEFAULT '[]', ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
UPDATE "Event" SET "audience" = CASE WHEN "isPublic" THEN 'RECRUITMENT' ELSE 'MEMBERS' END;
ALTER TABLE "Event" ADD CONSTRAINT "Meeting_audience_check" CHECK (("audience" = 'RECRUITMENT' AND "isPublic") OR ("audience" = 'MEMBERS' AND NOT "isPublic"));
ALTER TABLE "Event" ADD CONSTRAINT "Meeting_end_check" CHECK ("endDate" IS NULL OR "endDate" > "date");
CREATE TABLE "MeetingCheckInToken" (
 "id" TEXT PRIMARY KEY, "meetingId" TEXT NOT NULL REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "tokenHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "issuedBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "MeetingCheckInToken_tokenHash_key" ON "MeetingCheckInToken"("tokenHash");
CREATE INDEX "MeetingCheckInToken_meetingId_expiresAt_idx" ON "MeetingCheckInToken"("meetingId","expiresAt");
ALTER TABLE "MeetingCheckInToken" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "MeetingCheckInToken" FROM PUBLIC;
DO $$ DECLARE api_role text; BEGIN
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN EXECUTE format('REVOKE ALL ON "MeetingCheckInToken" FROM %I',api_role); END IF;
 END LOOP;
END $$;
COMMIT;
