BEGIN;
CREATE TABLE "SchoolRequest" (
  id TEXT PRIMARY KEY,
  "fullName" TEXT NOT NULL CHECK(length(trim("fullName")) BETWEEN 2 AND 120),
  email TEXT NOT NULL CHECK(length(email) BETWEEN 3 AND 254),
  university TEXT NOT NULL CHECK(length(trim(university)) BETWEEN 2 AND 200),
  role TEXT NOT NULL CHECK(role IN ('STUDENT','CLUB_LEADER','UNIVERSITY_ADMINISTRATOR')),
  organization TEXT NOT NULL DEFAULT '' CHECK(length(organization) <= 200),
  message TEXT NOT NULL DEFAULT '' CHECK(length(message) <= 2000),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','IN_REVIEW','CONTACTED','CLOSED')),
  "reviewNote" TEXT CHECK(length("reviewNote") <= 2000),
  "reviewedBy" TEXT REFERENCES "User"(id) ON DELETE RESTRICT,
  "reviewedAt" TIMESTAMP(3),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CHECK(status = 'PENDING' OR ("reviewNote" IS NOT NULL AND length(trim("reviewNote")) >= 10 AND "reviewedBy" IS NOT NULL AND "reviewedAt" IS NOT NULL))
);
CREATE INDEX "SchoolRequest_status_createdAt_idx" ON "SchoolRequest"(status,"createdAt");
CREATE INDEX "SchoolRequest_email_createdAt_idx" ON "SchoolRequest"(email,"createdAt");
CREATE INDEX "SchoolRequest_createdAt_idx" ON "SchoolRequest"("createdAt");
ALTER TABLE "SchoolRequest" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "SchoolRequest" FROM PUBLIC;
CREATE POLICY outclass_school_requests_server_only ON "SchoolRequest" AS RESTRICTIVE FOR ALL TO PUBLIC USING(false) WITH CHECK(false);
DO $$ DECLARE r TEXT; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON "SchoolRequest" FROM %I',r);
    END IF;
  END LOOP;
END $$;
COMMIT;
