BEGIN;
-- Old snapshot tokens never gain mutation privileges after deployment.
ALTER TABLE public."PlatformViewSession" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'READ_ONLY';
ALTER TABLE public."AuditLog" ADD COLUMN "effectiveUserId" TEXT, ADD COLUMN "supportSessionId" TEXT;
CREATE TABLE public."UserTutorial" (
  "userId" TEXT NOT NULL REFERENCES public."User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "experience" TEXT NOT NULL CHECK ("experience" IN ('student', 'leader')),
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK ("status" IN ('IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
  "step" INTEGER NOT NULL DEFAULT 0 CHECK ("step" >= 0 AND "step" <= 7),
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("userId", "experience")
);
ALTER TABLE public."UserTutorial" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."UserTutorial" FROM PUBLIC, anon, authenticated;
COMMIT;
