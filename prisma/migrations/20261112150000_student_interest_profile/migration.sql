-- Optional club-interest survey answers (lib/interest-survey.ts), one row per student.
-- Additive only: no existing table, trigger, grant or row changes; no backfill (students without a
-- row see the optional prompt once). Private to the student and server-only, like
-- WebPushSubscription (20261111090000): RLS on, no browser-role access, and only the bounded
-- runtime role with explicit policies. Server actions read and write only the caller's own row.
-- ON DELETE CASCADE from "User" removes the row with the account.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE "StudentInterestProfile" (
 "userId" TEXT NOT NULL,
 "interests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "goals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "weeklyHours" TEXT,
 "selectivity" TEXT,
 "revision" INTEGER NOT NULL DEFAULT 0,
 "completedAt" TIMESTAMP(3),
 "dismissedAt" TIMESTAMP(3),
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "StudentInterestProfile_pkey" PRIMARY KEY ("userId"),
 CONSTRAINT "StudentInterestProfile_interests_bounded" CHECK (cardinality("interests") <= 6 AND array_position("interests", NULL) IS NULL AND array_to_string("interests", ',') ~ '^([a-z][a-z0-9-]{0,39}(,|$))*$'),
 CONSTRAINT "StudentInterestProfile_goals_bounded" CHECK (cardinality("goals") <= 6 AND array_position("goals", NULL) IS NULL AND array_to_string("goals", ',') ~ '^([a-z][a-z0-9-]{0,39}(,|$))*$'),
 CONSTRAINT "StudentInterestProfile_weeklyHours" CHECK ("weeklyHours" IS NULL OR "weeklyHours" IN ('1-2','3-5','6+')),
 CONSTRAINT "StudentInterestProfile_selectivity" CHECK ("selectivity" IS NULL OR "selectivity" IN ('yes','no','either')),
 CONSTRAINT "StudentInterestProfile_revision" CHECK ("revision" >= 0)
);
ALTER TABLE "StudentInterestProfile" ADD CONSTRAINT "StudentInterestProfile_userId_fkey"
 FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentInterestProfile" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "StudentInterestProfile" FROM PUBLIC;
DO $runtime$
DECLARE r text;
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
  EXECUTE format('REVOKE ALL ON "StudentInterestProfile" FROM %I',r);
 END IF; END LOOP;
 -- Only the existing bounded server role, with explicit row policies (see 20261103200000).
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN
  GRANT SELECT,INSERT,UPDATE,DELETE ON "StudentInterestProfile" TO outclass_production_app;
  CREATE POLICY student_interest_runtime_read ON "StudentInterestProfile" FOR SELECT TO outclass_production_app USING (true);
  CREATE POLICY student_interest_runtime_insert ON "StudentInterestProfile" FOR INSERT TO outclass_production_app WITH CHECK (true);
  CREATE POLICY student_interest_runtime_update ON "StudentInterestProfile" FOR UPDATE TO outclass_production_app USING (true) WITH CHECK (true);
  CREATE POLICY student_interest_runtime_delete ON "StudentInterestProfile" FOR DELETE TO outclass_production_app USING (true);
 END IF;
END $runtime$;
COMMIT;
