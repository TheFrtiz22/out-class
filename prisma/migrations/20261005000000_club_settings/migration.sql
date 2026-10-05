BEGIN;
-- Additive only. Existing clubs remain open and listed; existing IDs and answers survive.
ALTER TABLE "Club"
  ADD COLUMN "applicationOpen" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "applicationDeadline" TIMESTAMP(3),
  ADD COLUMN "applicationVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pipelineVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "isDiscoverable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "invitationEmailEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ApplicationQuestion"
  ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "options" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "archivedAt" TIMESTAMP(3);
-- Preserve the student form's previous deterministic ID order.
WITH ordered AS (
  SELECT id, row_number() OVER (PARTITION BY "clubId" ORDER BY id) - 1 AS position FROM "ApplicationQuestion"
) UPDATE "ApplicationQuestion" q SET "order" = ordered.position FROM ordered WHERE q.id = ordered.id;
ALTER TABLE "PipelineRound"
  ADD COLUMN "type" TEXT NOT NULL DEFAULT 'CUSTOM',
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "configuration" JSONB NOT NULL DEFAULT '{}',
  ADD CONSTRAINT "PipelineRound_type_check" CHECK (type IN ('APPLICATION_REVIEW','INTERVIEW','GROUP_INTERVIEW','CASE_TASK','VOTE','CUSTOM','FINAL_DECISION')),
  ADD CONSTRAINT "PipelineRound_configuration_check" CHECK (jsonb_typeof(configuration) = 'object');
-- Infer only from actual dependencies, not round names. Legacy custom rounds remain usable.
UPDATE "PipelineRound" r SET type = 'APPLICATION_REVIEW'
WHERE r.id IN (SELECT DISTINCT ON ("clubId") id FROM "PipelineRound" ORDER BY "clubId", "order", id);
UPDATE "PipelineRound" r SET type = 'INTERVIEW' WHERE r.type = 'CUSTOM' AND
  (CASE WHEN jsonb_typeof(r."interviewKit") = 'array' THEN jsonb_array_length(r."interviewKit") ELSE 0 END > 0 OR EXISTS (SELECT 1 FROM "InterviewRoom" x WHERE x."roundId" = r.id) OR EXISTS (SELECT 1 FROM "InterviewRecord" x WHERE x."roundId" = r.id));
UPDATE "PipelineRound" r SET type = 'VOTE' WHERE r.type = 'CUSTOM' AND EXISTS (SELECT 1 FROM "VotingSession" x WHERE x."roundId" = r.id);
-- Retain every prior recruiter's ability to configure applications while permitting separate future grants.
UPDATE "ClubMember" m SET permissions = array_append(m.permissions, 'application.manage')
WHERE 'recruitment.manage' = ANY(m.permissions) AND NOT 'application.manage' = ANY(m.permissions)
  AND (NOT m."isOwner" OR (m.status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM "User" u WHERE u.id = m."userId" AND u."disabledAt" IS NULL
  )));
-- Disabled/inactive owners retain their stored grants; ownership already confers
-- every capability when active. Do not trip the ownership activation guard.
-- Invitation grants are immutable snapshots. New invitations use new role defaults;
-- existing pending/terminal invitations are preserved without disabling their guard.
CREATE INDEX "ApplicationQuestion_clubId_archivedAt_order_idx" ON "ApplicationQuestion"("clubId", "archivedAt", "order");
CREATE INDEX "PipelineRound_clubId_archivedAt_order_idx" ON "PipelineRound"("clubId", "archivedAt", "order");
CREATE INDEX "Application_clubId_status_roundId_idx" ON "Application"("clubId", status, "roundId");
-- Case-insensitive legacy identity lookup and scoped member/invitation directory reads.
CREATE INDEX "User_email_lower_idx" ON "User"(lower(email));
CREATE INDEX "ClubMember_clubId_status_joinedAt_idx" ON "ClubMember"("clubId", status, "joinedAt");
CREATE INDEX "ClubInvitation_clubId_status_createdAt_idx" ON "ClubInvitation"("clubId", status, "createdAt");
-- Default deny remains in place even if future permissive policies are added.
CREATE POLICY outclass_configuration_server_only ON "ApplicationQuestion" AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
CREATE POLICY outclass_configuration_server_only ON "PipelineRound" AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
COMMIT;
