BEGIN;
ALTER TABLE "Club" ADD COLUMN "suspendedAt" TIMESTAMP(3);
CREATE TABLE "AdminElevation" (
 id TEXT PRIMARY KEY, "actorId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
 "tokenHash" TEXT NOT NULL UNIQUE CHECK("tokenHash" ~ '^[a-f0-9]{64}$'),
 "authSessionId" TEXT NOT NULL, "factorId" TEXT NOT NULL,
 "passwordVerifiedAt" TIMESTAMP(3) NOT NULL, "mfaVerifiedAt" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3),
 CHECK("expiresAt">"createdAt" AND "expiresAt"<="createdAt"+interval '30 minutes'),
 CHECK("mfaVerifiedAt">="passwordVerifiedAt")
);
CREATE INDEX "AdminElevation_actorId_expiresAt_idx" ON "AdminElevation"("actorId","expiresAt");
CREATE TABLE "AdminElevationChallenge" (
 id TEXT PRIMARY KEY,"actorId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
 "tokenHash" TEXT NOT NULL UNIQUE CHECK("tokenHash" ~ '^[a-f0-9]{64}$'),
 "authSessionId" TEXT NOT NULL, "encryptedCredentials" TEXT NOT NULL,
 "factorId" TEXT NOT NULL,"providerChallengeId" TEXT NOT NULL,
 "passwordVerifiedAt" TIMESTAMP(3) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL,"consumedAt" TIMESTAMP(3), attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 CHECK("expiresAt">"createdAt" AND "expiresAt"<="createdAt"+interval '5 minutes')
);
CREATE INDEX "AdminElevationChallenge_actorId_createdAt_idx" ON "AdminElevationChallenge"("actorId","createdAt");
CREATE TABLE "PlatformReport" (
 id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('USER','CLUB','EVENT','CONTENT','SUPPORT')),
 "targetId" TEXT NOT NULL,"reporterId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
 summary TEXT NOT NULL CHECK(length(trim(summary)) BETWEEN 10 AND 2000),
 status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','INVESTIGATING','RESOLVED','DISMISSED')),
 resolution TEXT,"resolvedBy" TEXT,"resolvedAt" TIMESTAMP(3),revision INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CHECK(status NOT IN ('RESOLVED','DISMISSED') OR (length(trim(resolution))>=10 AND "resolvedBy" IS NOT NULL AND "resolvedAt" IS NOT NULL))
);
CREATE INDEX "PlatformReport_status_createdAt_idx" ON "PlatformReport"(status,"createdAt");
CREATE INDEX "PlatformReport_kind_targetId_idx" ON "PlatformReport"(kind,"targetId");
DO $$ DECLARE tbl text; r text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['AdminElevation','AdminElevationChallenge','PlatformReport'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',tbl);
  EXECUTE format('CREATE POLICY outclass_admin_server_only ON %I AS RESTRICTIVE FOR ALL TO PUBLIC USING(false) WITH CHECK(false)',tbl);
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON %I FROM %I',tbl,r); END IF;
  END LOOP;
 END LOOP;
END $$;
COMMIT;
