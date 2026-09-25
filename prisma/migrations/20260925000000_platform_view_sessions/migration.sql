CREATE TABLE "PlatformViewSession" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "tokenHash" TEXT NOT NULL UNIQUE,
 "actorId" TEXT NOT NULL,
 "targetUserId" TEXT NOT NULL,
 "clubId" TEXT,
 "reason" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "endedAt" TIMESTAMP(3)
);
CREATE INDEX "PlatformViewSession_actorId_endedAt_idx" ON "PlatformViewSession" ("actorId","endedAt");
ALTER TABLE "PlatformViewSession" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "PlatformViewSession" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON "PlatformViewSession" FROM anon; END IF;
 IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON "PlatformViewSession" FROM authenticated; END IF;
END $$;
