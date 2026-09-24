BEGIN;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "disabledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ClubMember" ADD COLUMN     "isOwner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "PlatformAdmin" (
    "userId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "clubId" TEXT,
    "reason" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubInvitation" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "permissions" TEXT[],
    "invitedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubClaim" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubTask" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "assigneeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformContent" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_clubId_createdAt_idx" ON "AuditLog"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "ClubInvitation_email_clubId_idx" ON "ClubInvitation"("email", "clubId");

-- CreateIndex
CREATE INDEX "ClubClaim_clubId_status_idx" ON "ClubClaim"("clubId", "status");

-- CreateIndex
CREATE INDEX "ClubTask_clubId_status_idx" ON "ClubTask"("clubId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformContent_key_key" ON "PlatformContent"("key");

-- AddForeignKey
ALTER TABLE "PlatformAdmin" ADD CONSTRAINT "PlatformAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubInvitation" ADD CONSTRAINT "ClubInvitation_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubInvitation" ADD CONSTRAINT "ClubInvitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubClaim" ADD CONSTRAINT "ClubClaim_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubClaim" ADD CONSTRAINT "ClubClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubTask" ADD CONSTRAINT "ClubTask_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubTask" ADD CONSTRAINT "ClubTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve existing access once, without continuing to authorize by legacy role.
UPDATE "ClubMember" SET "isOwner" = true,
  permissions = ARRAY['club.settings','members.manage','meetings.manage','meetings.attendance','tasks.manage','recruitment.manage','applications.review','applicants.identify','interviews.manage','decisions.vote','decisions.manage','leaders.manage']
WHERE role = 'PRESIDENT';
UPDATE "ClubMember" SET permissions = ARRAY['club.settings','members.manage','meetings.manage','meetings.attendance','tasks.manage','recruitment.manage','applications.review','applicants.identify','interviews.manage']
WHERE role = 'RECRUITMENT_LEAD';
UPDATE "ClubMember" SET permissions = ARRAY['applications.review','applicants.identify','meetings.attendance']
WHERE role = 'GENERAL_MEMBER';

-- These tables are server-managed; browser Supabase clients receive no direct access.
ALTER TABLE "PlatformAdmin" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClubInvitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClubClaim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClubTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformContent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClubMember" ENABLE ROW LEVEL SECURITY;

-- Application data is accessed through Prisma guards, never browser PostgREST writes.
DO $$
DECLARE tbl text; api_role text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['User','StudentProfile','Experience','Club','ClubMember','PipelineRound','ApplicationQuestion','Application','ApplicationAnswer','Evaluation','Event','EventAttendance','InterviewSlot','InterviewBooking','PlatformAdmin','AuditLog','ClubInvitation','ClubClaim','ClubTask','PlatformContent'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', tbl);
    FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', tbl, api_role);
      END IF;
    END LOOP;
  END LOOP;
END $$;

CREATE FUNCTION outclass_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit records are append-only'; END $$;
CREATE TRIGGER outclass_audit_immutable BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION outclass_audit_immutable();

COMMIT;
