-- Door mode (native app): a student's personal check-in pass, scanned by a leader who holds
-- meetings.attendance. The pass is a short-lived, single-use, identity-bound token; only its
-- SHA-256 hash is stored, as for MeetingCheckInToken. Attendance still lands in
-- "EventAttendance" under its existing (eventId, studentId) uniqueness rule.
-- Additive only: one new table. No existing table, trigger, grant, policy or row changes.
-- Server-only, like MeetingCheckInToken: RLS on, no browser-role access, and only the bounded
-- runtime role with explicit policies (same posture as 20261111090000_web_push_subscriptions).
-- Rollback: DROP TABLE "MeetingCheckInPass".
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE "MeetingCheckInPass" (
 "id" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "tokenHash" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "MeetingCheckInPass_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "MeetingCheckInPass_tokenHash_sha256" CHECK ("tokenHash" ~ '^[a-f0-9]{64}$'),
 -- A pass lives for seconds; nothing may mint a long-lived one.
 CONSTRAINT "MeetingCheckInPass_short_lived" CHECK ("expiresAt" <= "createdAt" + interval '5 minutes')
);
CREATE UNIQUE INDEX "MeetingCheckInPass_tokenHash_key" ON "MeetingCheckInPass"("tokenHash");
CREATE INDEX "MeetingCheckInPass_userId_expiresAt_idx" ON "MeetingCheckInPass"("userId", "expiresAt");
ALTER TABLE "MeetingCheckInPass" ADD CONSTRAINT "MeetingCheckInPass_userId_fkey"
 FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingCheckInPass" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "MeetingCheckInPass" FROM PUBLIC;
DO $runtime$
DECLARE r text;
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
  EXECUTE format('REVOKE ALL ON "MeetingCheckInPass" FROM %I',r);
 END IF; END LOOP;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN
  GRANT SELECT,INSERT,DELETE ON "MeetingCheckInPass" TO outclass_production_app;
  CREATE POLICY check_in_pass_runtime_read ON "MeetingCheckInPass" FOR SELECT TO outclass_production_app USING (true);
  CREATE POLICY check_in_pass_runtime_insert ON "MeetingCheckInPass" FOR INSERT TO outclass_production_app WITH CHECK (true);
  CREATE POLICY check_in_pass_runtime_delete ON "MeetingCheckInPass" FOR DELETE TO outclass_production_app USING (true);
 END IF;
END $runtime$;
COMMIT;
